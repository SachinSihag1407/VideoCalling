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

      setAppointment(appointmentRes.data);

      if (consentRes?.data) {
        setConsent(consentRes.data);
      }

      try {
        const interviewRes = await interviewsAPI.get(appointmentId);
        setInterview(interviewRes.data);
      } catch {
        // No interview yet
      }

      await initializeMedia(appointmentRes.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load appointment');
    } finally {
      setIsLoading(false);
    }
  };

  const initializeMedia = async (apptData?: Appointment) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setCallStatus('connected');
      if (apptData) {
        connectWebSocket(apptData.room_id);
      } else if (appointment?.room_id) {
         connectWebSocket(appointment.room_id);
      }
    } catch (err) {
      console.error('Failed to get media devices:', err);
      setError('Failed to access camera and microphone');
    }
  };

  const connectWebSocket = (roomId: string) => {
    if (!appointmentId || !roomId) return;

    const token = localStorage.getItem('token');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.hostname}:8000/api/ws/signaling/${roomId}?token=${token}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => console.log('WebSocket connected');
    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      handleSignalingMessage(data);
    };
    ws.onerror = (err) => console.error('WebSocket error:', err);
    ws.onclose = () => console.log('WebSocket closed');
  };

  const handleSignalingMessage = async (data: any) => {
    switch (data.type) {
      case 'user-joined':
        if (data.user_id !== user?.id) await createOffer();
        break;
      case 'offer':
        await handleOffer(data);
        break;
      case 'answer':
        await handleAnswer(data);
        break;
      case 'ice-candidate':
        await handleIceCandidate(data);
        break;
      case 'consent-requested':
        if (user?.role === 'patient') setShowConsentModal(true);
        break;
      case 'consent-response':
        if (data.granted) await loadConsentStatus();
        break;
      case 'recording-started':
        setIsRecording(true);
        break;
      case 'recording-stopped':
        setIsRecording(false);
        break;
    }
  };

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'ice-candidate',
          candidate: event.candidate,
          target_id: getRemoteUserId(),
        }));
      }
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    if (localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
    }

    pcRef.current = pc;
    return pc;
  };

  const getRemoteUserId = () => {
    if (!appointment || !user) return '';
    return user.role === 'doctor' ? appointment.patient_id : appointment.doctor_id;
  };

  const createOffer = async () => {
    const pc = createPeerConnection();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'offer',
        offer: offer,
        target_id: getRemoteUserId(),
      }));
    }
  };

  const handleOffer = async (data: any) => {
    const pc = createPeerConnection();
    await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'answer',
        answer: answer,
        target_id: data.from_id,
      }));
    }
  };

  const handleAnswer = async (data: any) => {
    if (pcRef.current) {
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
    }
  };

  const handleIceCandidate = async (data: any) => {
    if (pcRef.current && data.candidate) {
      await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
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
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoOn(!isVideoOn);
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
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
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      await new Promise((resolve) => setTimeout(resolve, 500));

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
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = async (event: any) => {
          let finalTranscript = '';
          let interimTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript = transcript;
              try {
                const speaker = user?.role === 'doctor' ? 'Doctor' : 'Patient';
                await interviewsAPI.addRealtimeChunk(appointmentId, transcript, speaker);
                setRealtimeTranscript(prev => {
                  const newLine = `[${speaker}]: ${transcript}`;
                  return prev ? `${prev}\n${newLine}` : newLine;
                });
              } catch (err) {
                console.error('Failed to send transcript chunk:', err);
              }
            } else {
              interimTranscript += transcript;
            }
          }

          const captionText = finalTranscript || interimTranscript;
          if (captionText) {
            setCurrentCaption(captionText);
            setTimeout(() => {
              setCurrentCaption(prev => prev === captionText ? '' : prev);
            }, 3000);
          }
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          if (event.error !== 'no-speech') {
            setTimeout(() => {
              if (isTranscribing && recognitionRef.current) {
                try {
                  recognitionRef.current.start();
                } catch (e) {}
              }
            }, 1000);
          }
        };

        recognition.onend = () => {
          if (isTranscribing && recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch (e) {}
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
      }

      transcriptIntervalRef.current = setInterval(async () => {
        try {
          const res = await interviewsAPI.getRealtimeTranscript(appointmentId);
          if (res.data.transcript) {
            setRealtimeTranscript(res.data.transcript);
          }
        } catch (err) {
          console.error('Failed to fetch transcript:', err);
        }
      }, 3000);
    } catch (err) {
      console.error('Failed to start real-time transcription:', err);
    }
  }, [appointmentId, user, isTranscribing]);

  const stopRealtimeTranscription = useCallback(async () => {
    if (!appointmentId) return;

    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }

      if (transcriptIntervalRef.current) {
        clearInterval(transcriptIntervalRef.current);
        transcriptIntervalRef.current = null;
      }

      await interviewsAPI.endRealtime(appointmentId);
      setIsTranscribing(false);

      const res = await interviewsAPI.getRealtimeTranscript(appointmentId);
      setRealtimeTranscript(res.data.transcript || '');
    } catch (err) {
      console.error('Failed to stop transcription:', err);
    }
  }, [appointmentId]);

  const generateSummary = async () => {
    if (!appointmentId) return;

    setIsGeneratingSummary(true);
    try {
      await interviewsAPI.generateSummary(appointmentId);
      const res = await interviewsAPI.getSummary(appointmentId);
      setSummary(res.data);
      setShowSummaryPanel(true);
    } catch (err) {
      console.error('Failed to generate summary:', err);
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
    if (localStream) localStream.getTracks().forEach((track) => track.stop());
    if (wsRef.current) wsRef.current.close();
    if (pcRef.current) pcRef.current.close();
    if (recognitionRef.current) recognitionRef.current.stop();
    if (transcriptIntervalRef.current) clearInterval(transcriptIntervalRef.current);
    if (callTimerRef.current) clearInterval(callTimerRef.current);
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
