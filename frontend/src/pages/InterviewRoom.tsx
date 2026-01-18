import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { appointmentsAPI, consentAPI, interviewsAPI } from '../services/api';
import { Appointment, Consent, Interview } from '../types';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Phone,
  Circle,
  Square,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowLeft,
  Hash,
  MessageSquare,
  Sparkles,
  Copy,
  RefreshCw,
  Settings,
  Users,
  Shield,
  Clock,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  MoreVertical,
  X,
  Zap,
  Activity,
  Brain
} from 'lucide-react';

const InterviewRoom: React.FC = () => {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [consent, setConsent] = useState<Consent | null>(null);
  const [interview, setInterview] = useState<Interview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Video state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [callStatus, setCallStatus] = useState<'connecting' | 'connected' | 'ended'>('connecting');
  const [callDuration, setCallDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Real-time transcription state
  const [realtimeTranscript, setRealtimeTranscript] = useState<string>('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [summary, setSummary] = useState<{ summary: string; key_points: string[] } | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [showSummaryPanel, setShowSummaryPanel] = useState(false);
  const [currentCaption, setCurrentCaption] = useState<string>('');
  const [showCaptions, setShowCaptions] = useState(true);
  const [showTranscriptPanel, setShowTranscriptPanel] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isTranscribingRef = useRef(isTranscribing);
  const localStreamRef = useRef<MediaStream | null>(null);
  const appointmentRef = useRef<Appointment | null>(null);
  const recognitionRestartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptChunkQueueRef = useRef<{text: string, speaker: string}[]>([]);
  const isProcessingChunkRef = useRef(false);

  useEffect(() => {
    isTranscribingRef.current = isTranscribing;
  }, [isTranscribing]);

  // Keep appointment ref in sync
  useEffect(() => {
    appointmentRef.current = appointment;
  }, [appointment]);

  // Sync local stream with video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      console.log('Setting local video srcObject');
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Sync remote stream with video element
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      console.log('Setting remote video srcObject');
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Force consent modal check on mount or when consent changes
  useEffect(() => {
    if (user?.role === 'patient') {
      if (!consent || consent.status === 'pending') {
        setShowConsentModal(true);
      } else if (consent.status === 'granted') {
        setShowConsentModal(false);
      }
    }
  }, [consent, user]);

  useEffect(() => {
    loadAppointmentData();
    return () => {
      cleanup();
    };
  }, [appointmentId]);

  useEffect(() => {
    if (callStatus === 'connected') {
      callTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    };
  }, [callStatus]);

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const loadAppointmentData = async () => {
    if (!appointmentId) return;

    try {
      const [appointmentRes, consentRes] = await Promise.all([
        appointmentsAPI.get(appointmentId),
        consentAPI.get(appointmentId).catch(() => null),
      ]);

      const apptData = appointmentRes.data;
      
      // Set both state and ref immediately
      setAppointment(apptData);
      appointmentRef.current = apptData;
      console.log('✅ Appointment loaded:', { 
        id: apptData.id, 
        doctor_id: apptData.doctor_id, 
        patient_id: apptData.patient_id 
      });

      if (consentRes?.data) {
        setConsent(consentRes.data);
      }

      try {
        const interviewRes = await interviewsAPI.get(appointmentId);
        setInterview(interviewRes.data);
      } catch {
        // No interview yet
      }

      // Initialize media - now appointment is guaranteed to be set
      await initializeMedia(apptData);
    } catch (err: any) {
      console.error('Load appointment error:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to load appointment');
    } finally {
      setIsLoading(false);
    }
  };

  const initializeMedia = async (apptData?: Appointment) => {
    try {
      console.log('Requesting media access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      console.log('Media access granted, tracks:', stream.getTracks().map(t => t.kind));
      
      // Store in both ref and state
      localStreamRef.current = stream;
      setLocalStream(stream);
      
      // Set video element directly
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        console.log('Local video element set');
      }
      
      setCallStatus('connecting');
      
      // Connect WebSocket after media is ready
      if (apptData?.room_id) {
        connectWebSocket(apptData.room_id);
      } else if (appointment?.room_id) {
        connectWebSocket(appointment.room_id);
      }
    } catch (err: any) {
      console.error('Failed to get media devices:', err);
      setError(`Failed to access camera and microphone: ${err.message}. Please check permissions.`);
      throw err;
    }
  };

  const connectWebSocket = (roomId: string) => {
    if (!appointmentId || !roomId) {
      console.error('Cannot connect WebSocket - missing appointmentId or roomId', { appointmentId, roomId });
      return;
    }

    const token = localStorage.getItem('token');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.hostname}:8000/api/ws/signaling/${roomId}?token=${token}`;

    console.log('Connecting WebSocket...', { roomId, user: user?.id, role: user?.role });
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('✅ WebSocket connected successfully');
      console.log('Sending ready message with user_id:', user?.id);
      ws.send(JSON.stringify({ type: 'ready', user_id: user?.id }));
    };
    
    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 Received signaling message:', data.type, data);
        await handleSignalingMessage(data);
      } catch (error) {
         console.error('❌ Failed to handle signaling message:', error, event.data);
      }
    };
    
    ws.onerror = (err) => console.error('❌ WebSocket error:', err);
    ws.onclose = () => console.log('🔌 WebSocket closed');
  };

  const handleSignalingMessage = async (data: any) => {
    console.log('🔄 Handling signaling message:', data.type);
    
    switch (data.type) {
      case 'room-info':
        console.log('🏠 Room info received:', {
          participants: data.participants,
          count: data.participants?.length,
          shouldCreateOffer: data.participants && data.participants.length > 1
        });
        // Only DOCTOR creates offer when joining a room with others
        if (data.participants && data.participants.length > 1 && user?.role === 'doctor') {
          console.log('👥 Multiple users in room, doctor creating offer...');
          await createOffer();
        } else {
          console.log('⏳ Waiting for other participant...');
        }
        break;
        
      case 'user-joined':
        console.log('👤 User joined:', data.user_id, 'My ID:', user?.id);
        if (data.user_id !== user?.id) {
          // Only DOCTOR creates offer when a new user joins
          if (user?.role === 'doctor') {
            console.log('🤝 New user joined, doctor creating offer...');
            await createOffer();
          } else {
            console.log('⏳ Patient waiting for doctor\'s offer...');
          }
        } else {
          console.log('ℹ️ Ignoring self-join message');
        }
        break;
        
      case 'offer':
        console.log('📩 Received offer from:', data.from_id);
        await handleOffer(data);
        break;
        
      case 'answer':
        console.log('✉️ Received answer from:', data.from_id);
        await handleAnswer(data);
        break;
        
      case 'ice-candidate':
        console.log('🧊 Received ICE candidate');
        await handleIceCandidate(data);
        break;
        
      case 'consent-requested':
        console.log('📋 Consent requested');
        if (user?.role === 'patient') setShowConsentModal(true);
        break;
        
      case 'consent-response':
        console.log('✅ Consent response:', data.granted);
        if (data.granted) await loadConsentStatus();
        break;
        
      case 'recording-started':
        console.log('🔴 Recording started');
        setIsRecording(true);
        break;
        
      case 'recording-stopped':
        console.log('⏹️ Recording stopped');
        setIsRecording(false);
        break;
        
      case 'user-left':
        console.log('👋 User left:', data.user_id);
        // Reset connection state when remote user leaves
        if (data.user_id !== user?.id) {
          setRemoteStream(null);
          setCallStatus('connecting');
          if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
          }
        }
        break;
        
      default:
        console.log('❓ Unknown message type:', data.type);
    }
  };

  const createPeerConnection = () => {
    // Close existing connection if any
    if (pcRef.current) {
      pcRef.current.close();
    }

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current) {
        console.log('Sending ICE candidate');
        wsRef.current.send(JSON.stringify({
          type: 'ice-candidate',
          candidate: event.candidate,
          target_id: getRemoteUserId(),
        }));
      }
    };

    pc.ontrack = (event) => {
      console.log('Received remote track:', event.track.kind, event.streams[0].id);
      const remoteStream = event.streams[0];
      setRemoteStream(remoteStream);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        console.log('Remote video element set');
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        console.log('Peer connection established!');
        setCallStatus('connected');
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        console.log('Connection lost, status:', pc.connectionState);
        setCallStatus('connecting');
      }
    };

    // Add local tracks using ref to avoid race conditions
    const stream = localStreamRef.current;
    if (stream) {
      console.log('Adding local tracks to peer connection:', stream.getTracks().length);
      stream.getTracks().forEach((track) => {
        console.log('Adding track:', track.kind, track.enabled);
        pc.addTrack(track, stream);
      });
    } else {
      console.warn('No local stream available when creating peer connection');
    }

    pcRef.current = pc;
    return pc;
  };

  const getRemoteUserId = () => {
    const appt = appointmentRef.current;
    if (!appt || !user) {
      console.warn('⚠️ Cannot get remote user ID - missing appointment or user', { appointment: appt, user });
      return '';
    }
    if (!appt.patient_id || !appt.doctor_id) {
      console.warn('⚠️ Appointment missing patient_id or doctor_id', { appointment: appt });
      return '';
    }
    const remoteId = user.role === 'doctor' ? appt.patient_id : appt.doctor_id;
    console.log('✅ Remote user ID:', remoteId, '(I am', user.role + ')');
    return remoteId;
  };

  const createOffer = async () => {
    try {
      console.log('🎯 Creating offer...');
      const remoteUserId = getRemoteUserId();
      
      if (!remoteUserId) {
        console.error('❌ Cannot create offer - no remote user ID available');
        return;
      }
      
      console.log('Current state:', {
        hasLocalStream: !!localStreamRef.current,
        localStreamTracks: localStreamRef.current?.getTracks().length,
        hasExistingPC: !!pcRef.current,
        remoteUserId
      });
      
      const pc = createPeerConnection();
      console.log('✅ Peer connection created');
      
      const offer = await pc.createOffer();
      console.log('✅ Offer created:', offer.type);
      
      await pc.setLocalDescription(offer);
      console.log('✅ Local description set');

      if (wsRef.current) {
        const message = {
          type: 'offer',
          offer: offer,
          target_id: remoteUserId,
        };
        console.log('📤 Sending offer to:', message.target_id);
        wsRef.current.send(JSON.stringify(message));
      } else {
        console.error('❌ WebSocket not available to send offer');
      }
    } catch (error) {
      console.error('❌ Error creating offer:', error);
    }
  };

  const handleOffer = async (data: any) => {
    try {
      console.log('🎯 Handling offer from:', data.from_id);
      console.log('Offer details:', data.offer?.type);
      console.log('Current state:', {
        hasLocalStream: !!localStreamRef.current,
        localStreamTracks: localStreamRef.current?.getTracks().length,
        hasExistingPC: !!pcRef.current
      });
      
      const pc = createPeerConnection();
      console.log('✅ Peer connection created for answer');
      
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      console.log('✅ Remote description set');
      
      const answer = await pc.createAnswer();
      console.log('✅ Answer created:', answer.type);
      
      await pc.setLocalDescription(answer);
      console.log('✅ Local description set with answer');

      if (wsRef.current) {
        const message = {
          type: 'answer',
          answer: answer,
          target_id: data.from_id,
        };
        console.log('📤 Sending answer to:', message.target_id);
        wsRef.current.send(JSON.stringify(message));
      } else {
        console.error('❌ WebSocket not available to send answer');
      }
    } catch (error) {
      console.error('❌ Error handling offer:', error);
    }
  };

  const handleAnswer = async (data: any) => {
    try {
      console.log('🎯 Handling answer from:', data.from_id);
      console.log('Answer details:', data.answer?.type);
      
      if (pcRef.current) {
        console.log('Current PC state:', pcRef.current.signalingState);
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
        console.log('✅ Remote description set with answer');
        console.log('New PC state:', pcRef.current.signalingState);
      } else {
        console.error('❌ No peer connection exists to handle answer');
      }
    } catch (error) {
      console.error('❌ Error handling answer:', error);
    }
  };

  const handleIceCandidate = async (data: any) => {
    try {
      console.log('🧊 Handling ICE candidate');
      if (pcRef.current && data.candidate) {
        console.log('Adding ICE candidate to peer connection');
        await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        console.log('✅ ICE candidate added');
      } else {
        if (!pcRef.current) console.error('❌ No peer connection to add ICE candidate');
        if (!data.candidate) console.error('❌ No candidate data received');
      }
    } catch (error) {
      console.error('❌ Error handling ICE candidate:', error);
    }
  };

  const loadConsentStatus = async () => {
    if (!appointmentId) return;
    try {
      const res = await consentAPI.get(appointmentId);
      setConsent(res.data);
    } catch {
      // No consent yet
    }
  };

  const toggleVideo = () => {
    const stream = localStreamRef.current;
    if (stream) {
      stream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoOn(!isVideoOn);
    }
  };

  const toggleAudio = () => {
    const stream = localStreamRef.current;
    if (stream) {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsAudioOn(!isAudioOn);
    }
  };

  const requestConsent = async () => {
    if (!appointmentId) return;

    try {
      if (!consent) {
        await consentAPI.create(appointmentId);
      }

      if (wsRef.current) {
        wsRef.current.send(JSON.stringify({ type: 'consent-requested' }));
      }
    } catch (err) {
      console.error('Failed to request consent:', err);
    }
  };

  const handleConsentResponse = async (granted: boolean) => {
    if (!appointmentId) return;

    try {
      // Ensure consent record exists first
      if (!consent) {
        await consentAPI.create(appointmentId);
      }
      
      await consentAPI.update(appointmentId, granted ? 'granted' : 'denied');
      await loadConsentStatus();
      setShowConsentModal(false);

      if (wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'consent-response',
          granted,
        }));
      }
    } catch (err) {
      console.error('Failed to respond to consent:', err);
    }
  };

  const startRecording = async () => {
    if (!appointmentId || !localStream) return;

    try {
      if (!interview) {
        const res = await interviewsAPI.create(appointmentId);
        setInterview(res.data);
      }

      await interviewsAPI.startRecording(appointmentId);

      const combinedStream = new MediaStream([
        ...localStream.getTracks(),
        ...(remoteStream?.getTracks() || []),
      ]);

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: 'video/webm',
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(1000);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);

      if (wsRef.current) {
        wsRef.current.send(JSON.stringify({ type: 'recording-started' }));
      }
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  };

  const stopRecording = async () => {
    if (!appointmentId || !mediaRecorderRef.current) return;

    try {
      const stopPromise = new Promise<void>((resolve) => {
         if (mediaRecorderRef.current) {
            mediaRecorderRef.current.onstop = () => resolve();
         } else {
            resolve();
         }
      });
      
      mediaRecorderRef.current.stop();
      await stopPromise;
      
      setIsRecording(false);

      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const file = new File([blob], 'interview.webm', { type: 'video/webm' });
      await interviewsAPI.uploadRecording(appointmentId, file);

      await interviewsAPI.stopRecording(appointmentId);

      const res = await interviewsAPI.get(appointmentId);
      setInterview(res.data);

      recordedChunksRef.current = [];

      if (wsRef.current) {
        wsRef.current.send(JSON.stringify({ type: 'recording-stopped' }));
      }
    } catch (err) {
      console.error('Failed to stop recording:', err);
    }
  };

  // Real-time transcription
  const startRealtimeTranscription = useCallback(async () => {
    if (!appointmentId) return;

    try {
      await interviewsAPI.startRealtime(appointmentId);
      setIsTranscribing(true);

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        console.error('Speech recognition not supported in this browser');
        setError('Speech recognition is not supported in your browser. Please use Chrome or Edge.');
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

      // Process queued transcript chunks
      const processTranscriptQueue = async () => {
        if (isProcessingChunkRef.current || transcriptChunkQueueRef.current.length === 0) {
          return;
        }

        isProcessingChunkRef.current = true;
        const chunk = transcriptChunkQueueRef.current.shift();

        if (chunk) {
          try {
            await interviewsAPI.addRealtimeChunk(appointmentId, chunk.text, chunk.speaker);
            
            setRealtimeTranscript(prev => {
              const newLine = `[${chunk.speaker}]: ${chunk.text}`;
              return prev ? `${prev}\n${newLine}` : newLine;
            });
          } catch (err) {
            console.error('Failed to send transcript chunk:', err);
            // Re-add to queue if failed
            transcriptChunkQueueRef.current.unshift(chunk);
          }
        }

        isProcessingChunkRef.current = false;
        
        // Process next chunk if available
        if (transcriptChunkQueueRef.current.length > 0) {
          setTimeout(processTranscriptQueue, 100);
        }
      };

      recognition.onresult = async (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript.trim();
          if (event.results[i].isFinal && transcript) {
            finalTranscript = transcript;
            const speaker = user?.role === 'doctor' ? 'Doctor' : 'Patient';
            
            // Queue the chunk for processing
            transcriptChunkQueueRef.current.push({ text: transcript, speaker });
            processTranscriptQueue();
          } else if (transcript) {
            interimTranscript += transcript;
          }
        }

        const captionText = finalTranscript || interimTranscript;
        if (captionText) {
          setCurrentCaption(captionText);
          // Auto-hide caption after 5 seconds
          setTimeout(() => {
            setCurrentCaption(prev => prev === captionText ? '' : prev);
          }, 5000);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        
        // Handle different error types
        switch (event.error) {
          case 'no-speech':
            // User not speaking - this is normal, don't restart immediately
            console.log('No speech detected, waiting...');
            break;
            
          case 'audio-capture':
            console.error('Microphone not available');
            setError('Microphone not available. Please check your microphone settings.');
            stopRealtimeTranscription();
            break;
            
          case 'not-allowed':
            console.error('Microphone permission denied');
            setError('Microphone permission denied. Please allow microphone access.');
            stopRealtimeTranscription();
            break;
            
          case 'network':
            // Network error - retry after delay
            console.log('Network error, will retry...');
            if (recognitionRestartTimeoutRef.current) {
              clearTimeout(recognitionRestartTimeoutRef.current);
            }
            recognitionRestartTimeoutRef.current = setTimeout(() => {
              if (isTranscribingRef.current && recognitionRef.current) {
                try {
                  recognitionRef.current.start();
                  console.log('Restarted speech recognition after network error');
                } catch (e) {
                  console.error('Failed to restart recognition:', e);
                }
              }
            }, 2000);
            break;
            
          case 'aborted':
            // Recognition was aborted - restart if still transcribing
            if (isTranscribingRef.current) {
              setTimeout(() => {
                if (recognitionRef.current) {
                  try {
                    recognitionRef.current.start();
                  } catch (e) {
                    console.error('Failed to restart after abort:', e);
                  }
                }
              }, 500);
            }
            break;
            
          default:
            console.error('Unknown speech recognition error:', event.error);
        }
      };

      recognition.onend = () => {
        console.log('Speech recognition ended');
        // Auto-restart if still transcribing
        if (isTranscribingRef.current && recognitionRef.current) {
          if (recognitionRestartTimeoutRef.current) {
            clearTimeout(recognitionRestartTimeoutRef.current);
          }
          recognitionRestartTimeoutRef.current = setTimeout(() => {
            try {
              if (recognitionRef.current) {
                recognitionRef.current.start();
                console.log('Restarted speech recognition');
              }
            } catch (e) {
              console.error('Failed to restart recognition:', e);
            }
          }, 500);
        }
      };

      recognition.onstart = () => {
        console.log('✅ Speech recognition started');
      };

      recognitionRef.current = recognition;
      recognition.start();

      // Poll for transcript updates from backend
      transcriptIntervalRef.current = setInterval(async () => {
        if (!isTranscribingRef.current) return;
        
        try {
          const res = await interviewsAPI.getRealtimeTranscript(appointmentId);
          if (res.data.transcript) {
            // Only update if different to avoid flickering
            setRealtimeTranscript(prev => {
              if (prev !== res.data.transcript) {
                return res.data.transcript;
              }
              return prev;
            });
          }
        } catch (err: any) {
          // Only log non-401 errors (401 means other user's token)
          if (err.response?.status !== 401) {
            console.error('Failed to fetch transcript:', err);
          }
        }
      }, 5000); // Poll every 5 seconds
    } catch (err) {
      console.error('Failed to start real-time transcription:', err);
      setError('Failed to start transcription. Please try again.');
      setIsTranscribing(false);
    }
  }, [appointmentId, user]);

  const stopRealtimeTranscription = useCallback(async () => {
    if (!appointmentId) return;

    try {
      console.log('Stopping transcription...');
      isTranscribingRef.current = false;
      
      // Clear restart timeout
      if (recognitionRestartTimeoutRef.current) {
        clearTimeout(recognitionRestartTimeoutRef.current);
        recognitionRestartTimeoutRef.current = null;
      }
      
      // Stop recognition
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.warn('Error stopping recognition:', e);
        }
        recognitionRef.current = null;
      }

      // Clear polling interval
      if (transcriptIntervalRef.current) {
        clearInterval(transcriptIntervalRef.current);
        transcriptIntervalRef.current = null;
      }

      // Process any remaining chunks in queue
      while (transcriptChunkQueueRef.current.length > 0 && isProcessingChunkRef.current === false) {
        const chunk = transcriptChunkQueueRef.current.shift();
        if (chunk) {
          try {
            await interviewsAPI.addRealtimeChunk(appointmentId, chunk.text, chunk.speaker);
          } catch (err) {
            console.error('Failed to send final chunk:', err);
          }
        }
      }

      // End transcription session on backend
      await interviewsAPI.endRealtime(appointmentId);
      setIsTranscribing(false);

      // Fetch final transcript
      const res = await interviewsAPI.getRealtimeTranscript(appointmentId);
      setRealtimeTranscript(res.data.transcript || '');
      
      console.log('✅ Transcription stopped successfully');
    } catch (err) {
      console.error('Failed to stop transcription:', err);
      setIsTranscribing(false);
    }
  }, [appointmentId]);

  const generateSummary = async () => {
    if (!appointmentId) return;

    // Validate transcript exists and has content
    if (!realtimeTranscript || realtimeTranscript.trim().length < 50) {
      setError('Transcript is too short to generate a summary. Please transcribe more content first.');
      return;
    }

    setIsGeneratingSummary(true);
    setError(''); // Clear any previous errors
    
    try {
      console.log('Generating summary...');
      await interviewsAPI.generateSummary(appointmentId);
      
      const res = await interviewsAPI.getSummary(appointmentId);
      if (res.data && (res.data.summary || res.data.key_points)) {
        setSummary(res.data);
        setShowSummaryPanel(true);
        console.log('✅ Summary generated successfully');
      } else {
        throw new Error('Summary generation returned empty results');
      }
    } catch (err: any) {
      console.error('Failed to generate summary:', err);
      const errorMsg = err.response?.data?.detail || err.message || 'Failed to generate summary';
      setError(`Summary generation failed: ${errorMsg}. Please try again.`);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const endCall = async () => {
    if (isRecording) await stopRecording();
    if (isTranscribing) await stopRealtimeTranscription();

    cleanup();

    if (user?.role === 'doctor' && appointmentId) {
      try {
        await appointmentsAPI.update(appointmentId, { status: 'completed' });
      } catch (err) {
        console.error('Failed to complete appointment:', err);
      }
    }

    navigate('/dashboard');
  };

  const cleanup = () => {
    console.log('Cleaning up resources...');
    
    // Stop local media
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    
    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    // Close peer connection
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    
    // Stop speech recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn('Error stopping recognition during cleanup:', e);
      }
      recognitionRef.current = null;
    }
    
    // Clear all intervals and timeouts
    if (transcriptIntervalRef.current) {
      clearInterval(transcriptIntervalRef.current);
      transcriptIntervalRef.current = null;
    }
    
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    
    if (recognitionRestartTimeoutRef.current) {
      clearTimeout(recognitionRestartTimeoutRef.current);
      recognitionRestartTimeoutRef.current = null;
    }
    
    // Clear transcript queue
    transcriptChunkQueueRef.current = [];
    isProcessingChunkRef.current = false;
    
    console.log('✅ Cleanup complete');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative mx-auto w-20 h-20">
            <div className="absolute inset-0 border-4 border-blue-500/30 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-transparent border-t-blue-500 rounded-full animate-spin"></div>
            <Video className="absolute inset-0 m-auto w-8 h-8 text-blue-400" />
          </div>
          <p className="text-gray-400 mt-6 font-medium">Setting up your consultation room...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 rounded-3xl p-8 max-w-md text-center border border-slate-700">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Unable to Join</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-medium"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      {/* Transcript Panel Overlay */}
      {(showTranscriptPanel || isTranscribing) && (
        <div className="fixed left-6 top-24 bottom-24 w-80 bg-white/95 backdrop-blur-md shadow-2xl rounded-2xl overflow-hidden flex flex-col z-50 transition-all duration-300 border border-white/20">
            <div className="p-4 bg-gray-50/90 border-b flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-indigo-600" />
                    <h3 className="font-semibold text-gray-800">Live Transcript</h3>
                </div>
                {isTranscribing && (
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-red-50 text-red-600 rounded-full text-xs font-medium animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
                        LIVE
                    </div>
                )}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-sm bg-gray-50/50">
               {realtimeTranscript ? (
                 <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                   {realtimeTranscript}
                 </div>
               ) : (
                 <div className="text-gray-400 text-center italic mt-10">
                   Waiting for speech...
                 </div>
               )}
            </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-xl border-b border-slate-700/50 px-4 lg:px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 text-gray-400 hover:text-white hover:bg-slate-700 rounded-xl transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="hidden sm:block">
              <div className="flex items-center space-x-3">
                <h1 className="text-white font-semibold">Video Consultation</h1>
                <span className="px-2.5 py-1 bg-slate-700 rounded-lg text-xs font-mono text-blue-400 flex items-center">
                  <Hash className="w-3 h-3 mr-1" />
                  {appointment?.meeting_number}
                </span>
              </div>
              <p className="text-gray-400 text-sm">
                {user?.role === 'doctor' ? 'Patient: ' : 'Doctor: '}
                {user?.role === 'doctor' ? appointment?.patient?.full_name : appointment?.doctor?.full_name}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Call Duration */}
            <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 bg-slate-700/50 rounded-lg">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-white font-mono text-sm">{formatDuration(callDuration)}</span>
            </div>

            {/* Status Pills */}
            {callStatus === 'connected' && (
              <div className="flex items-center space-x-2 px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/30 rounded-full">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                <span className="text-emerald-400 text-sm font-medium hidden sm:inline">Connected</span>
              </div>
            )}
            {isTranscribing && (
              <div className="flex items-center space-x-2 px-3 py-1.5 bg-purple-500/20 border border-purple-500/30 rounded-full">
                <Activity className="w-3 h-3 text-purple-400 animate-pulse" />
                <span className="text-purple-400 text-sm font-medium hidden sm:inline">Live</span>
              </div>
            )}
            {isRecording && (
              <div className="flex items-center space-x-2 px-3 py-1.5 bg-red-500/20 border border-red-500/30 rounded-full animate-pulse">
                <Circle className="w-3 h-3 fill-red-500 text-red-500" />
                <span className="text-red-400 text-sm font-medium hidden sm:inline">REC</span>
              </div>
            )}
            {consent?.status === 'granted' && (
              <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 bg-blue-500/20 border border-blue-500/30 rounded-full">
                <Shield className="w-4 h-4 text-blue-400" />
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col lg:flex-row p-4 gap-4 overflow-hidden">
        {/* Video Section */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Video Grid */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">
            {/* Remote Video */}
            <div className="relative bg-slate-800 rounded-2xl overflow-hidden border border-slate-700/50 shadow-2xl">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover min-h-[200px] lg:min-h-[300px]"
              />
              {!remoteStream && (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
                  <div className="text-center">
                    <div className="w-24 h-24 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Users className="w-12 h-12 text-slate-500" />
                    </div>
                    <p className="text-gray-400">Waiting for {user?.role === 'doctor' ? 'patient' : 'doctor'}...</p>
                  </div>
                </div>
              )}
              <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-lg">
                <span className="text-white text-sm font-medium">
                  {user?.role === 'doctor' ? appointment?.patient?.full_name : appointment?.doctor?.full_name}
                </span>
              </div>
            </div>

            {/* Local Video */}
            <div className="relative bg-slate-800 rounded-2xl overflow-hidden border border-slate-700/50 shadow-2xl">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover min-h-[200px] lg:min-h-[300px]"
              />
              {!isVideoOn && (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
                  <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center">
                    <VideoOff className="w-10 h-10 text-slate-500" />
                  </div>
                </div>
              )}
              <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-lg">
                <span className="text-white text-sm font-medium">You</span>
              </div>
              {!isAudioOn && (
                <div className="absolute top-4 right-4 p-2 bg-red-500/90 rounded-xl">
                  <MicOff className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
          </div>

          {/* Live Captions */}
          {showCaptions && isTranscribing && currentCaption && (
            <div className="flex justify-center animate-in fade-in slide-in-from-bottom duration-300">
              <div className="bg-black/90 backdrop-blur-xl px-6 py-3 rounded-2xl max-w-2xl border border-slate-700/50 shadow-xl">
                <div className="flex items-center space-x-3">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                  <span className="text-white text-lg">{currentCaption}</span>
                </div>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-4 border border-slate-700/50">
            <div className="flex flex-wrap items-center justify-center gap-3">
              {/* Basic Controls */}
              <button
                onClick={toggleAudio}
                className={`p-4 rounded-2xl transition-all ${
                  isAudioOn 
                    ? 'bg-slate-700 hover:bg-slate-600 text-white' 
                    : 'bg-red-500 hover:bg-red-600 text-white'
                }`}
                title={isAudioOn ? 'Mute' : 'Unmute'}
              >
                {isAudioOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
              </button>

              <button
                onClick={toggleVideo}
                className={`p-4 rounded-2xl transition-all ${
                  isVideoOn 
                    ? 'bg-slate-700 hover:bg-slate-600 text-white' 
                    : 'bg-red-500 hover:bg-red-600 text-white'
                }`}
                title={isVideoOn ? 'Turn off camera' : 'Turn on camera'}
              >
                {isVideoOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
              </button>

              <div className="w-px h-10 bg-slate-700 mx-2"></div>

              {/* Recording - Doctor only */}
              {user?.role === 'doctor' && (
                <>
                  {consent?.status !== 'granted' ? (
                    <button
                      onClick={requestConsent}
                      className="px-5 py-4 bg-amber-500 hover:bg-amber-600 rounded-2xl text-white flex items-center space-x-2 transition-all"
                      title="Request consent"
                    >
                      <Shield className="w-5 h-5" />
                      <span className="hidden sm:inline font-medium">Request Consent</span>
                    </button>
                  ) : !isRecording ? (
                    <button
                      onClick={startRecording}
                      className="px-5 py-4 bg-red-500 hover:bg-red-600 rounded-2xl text-white flex items-center space-x-2 transition-all"
                    >
                      <Circle className="w-5 h-5" />
                      <span className="hidden sm:inline font-medium">Record</span>
                    </button>
                  ) : (
                    <button
                      onClick={stopRecording}
                      className="px-5 py-4 bg-red-500 hover:bg-red-600 rounded-2xl text-white flex items-center space-x-2 transition-all animate-pulse"
                    >
                      <Square className="w-5 h-5 fill-white" />
                      <span className="hidden sm:inline font-medium">Stop</span>
                    </button>
                  )}
                </>
              )}

              {/* Transcription */}
              {consent?.status === 'granted' && (
                <button
                  onClick={isTranscribing ? stopRealtimeTranscription : startRealtimeTranscription}
                  className={`px-5 py-4 rounded-2xl flex items-center space-x-2 transition-all ${
                    isTranscribing 
                      ? 'bg-purple-500 hover:bg-purple-600' 
                      : 'bg-slate-700 hover:bg-slate-600'
                  } text-white`}
                  title={isTranscribing ? 'Stop transcription' : 'Start transcription'}
                >
                  <MessageSquare className="w-5 h-5" />
                  <span className="hidden sm:inline font-medium">{isTranscribing ? 'Stop' : 'Captions'}</span>
                </button>
              )}

              {/* Caption Toggle */}
              {isTranscribing && (
                <button
                  onClick={() => setShowCaptions(!showCaptions)}
                  className={`p-4 rounded-2xl transition-all ${
                    showCaptions ? 'bg-blue-500 text-white' : 'bg-slate-700 text-gray-400'
                  }`}
                  title={showCaptions ? 'Hide captions' : 'Show captions'}
                >
                  {showCaptions ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                </button>
              )}

              {/* Transcript Panel Toggle */}
              {realtimeTranscript && (
                <button
                  onClick={() => setShowTranscriptPanel(!showTranscriptPanel)}
                  className={`p-4 rounded-2xl transition-all ${
                    showTranscriptPanel ? 'bg-blue-500 text-white' : 'bg-slate-700 text-white hover:bg-slate-600'
                  }`}
                  title="Toggle transcript panel"
                >
                  <FileText className="w-5 h-5" />
                </button>
              )}

              {/* Summary - Doctor only */}
              {user?.role === 'doctor' && realtimeTranscript && (
                <button
                  onClick={generateSummary}
                  disabled={isGeneratingSummary}
                  className={`px-5 py-4 rounded-2xl flex items-center space-x-2 transition-all ${
                    isGeneratingSummary 
                      ? 'bg-slate-600 cursor-wait' 
                      : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600'
                  } text-white`}
                >
                  {isGeneratingSummary ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <Brain className="w-5 h-5" />
                  )}
                  <span className="hidden sm:inline font-medium">{isGeneratingSummary ? 'Processing...' : 'Summary'}</span>
                </button>
              )}

              <div className="w-px h-10 bg-slate-700 mx-2"></div>

              {/* End Call */}
              <button
                onClick={endCall}
                className="px-6 py-4 bg-red-600 hover:bg-red-700 rounded-2xl text-white flex items-center space-x-2 transition-all shadow-lg shadow-red-500/30"
              >
                <Phone className="w-5 h-5 rotate-[135deg]" />
                <span className="hidden sm:inline font-medium">End</span>
              </button>
            </div>
          </div>
        </div>

        {/* Side Panel - Transcript & Summary */}
        {(showTranscriptPanel || showSummaryPanel) && (
          <div className="w-full lg:w-96 flex flex-col gap-4 max-h-[600px] lg:max-h-none overflow-hidden">
            {/* Transcript Panel */}
            {showTranscriptPanel && realtimeTranscript && (
              <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 flex flex-col overflow-hidden flex-1">
                <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-5 h-5 text-blue-400" />
                    <span className="text-white font-semibold">Live Transcript</span>
                    {isTranscribing && (
                      <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                    )}
                  </div>
                  <button
                    onClick={() => copyToClipboard(realtimeTranscript)}
                    className="p-2 hover:bg-slate-700 rounded-lg transition"
                    title="Copy transcript"
                  >
                    <Copy className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <pre className="text-gray-300 text-sm whitespace-pre-wrap font-sans leading-relaxed">
                    {realtimeTranscript}
                  </pre>
                </div>
              </div>
            )}

            {/* Summary Panel */}
            {showSummaryPanel && summary && (
              <div className="bg-gradient-to-br from-slate-800/80 to-emerald-900/30 backdrop-blur-xl rounded-2xl border border-emerald-500/30 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-5 h-5 text-emerald-400" />
                    <span className="text-white font-semibold">AI Summary</span>
                  </div>
                  <button
                    onClick={() => setShowSummaryPanel(false)}
                    className="p-2 hover:bg-slate-700 rounded-lg transition"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <div>
                    <h4 className="text-emerald-400 text-sm font-medium mb-2">Summary</h4>
                    <p className="text-gray-300 text-sm leading-relaxed">{summary.summary}</p>
                  </div>
                  {summary.key_points.length > 0 && (
                    <div>
                      <h4 className="text-emerald-400 text-sm font-medium mb-2">Key Points</h4>
                      <ul className="space-y-2">
                        {summary.key_points.map((point, index) => (
                          <li key={index} className="flex items-start space-x-2 text-sm text-gray-300">
                            <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Consent Modal */}
      {showConsentModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-3xl max-w-md w-full p-8 border border-slate-700 shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-amber-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Recording Consent</h2>
              <p className="text-gray-400">
                The doctor is requesting permission to record this consultation for medical documentation.
              </p>
            </div>

            <div className="bg-slate-700/50 rounded-xl p-4 mb-6">
              <p className="text-gray-300 text-sm">
                By granting consent, you agree that this video consultation may be recorded and transcribed 
                for medical record keeping purposes. You can revoke this consent at any time.
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => handleConsentResponse(false)}
                className="flex-1 px-6 py-3.5 bg-slate-700 text-white rounded-xl hover:bg-slate-600 transition font-medium flex items-center justify-center space-x-2"
              >
                <XCircle className="w-5 h-5" />
                <span>Decline</span>
              </button>
              <button
                onClick={() => handleConsentResponse(true)}
                className="flex-1 px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:from-emerald-600 hover:to-teal-600 transition font-medium flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/30"
              >
                <CheckCircle className="w-5 h-5" />
                <span>Allow</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InterviewRoom;
