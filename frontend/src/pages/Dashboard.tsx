import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { appointmentsAPI, authAPI } from '../services/api';
import { Appointment, User } from '../types';
import { format, isFuture, isToday, parseISO } from 'date-fns';
import {
  Calendar,
  Clock,
  Plus,
  Video,
  CheckCircle,
  XCircle,
  AlertCircle,
  Users,
  FileText,
  HelpCircle,
  LogOut,
  Stethoscope,
  Info,
  ArrowRight,
  Bell,
  RefreshCw,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewAppointment, setShowNewAppointment] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [newAppointment, setNewAppointment] = useState({
    doctor_id: '',
    scheduled_time: '',
    reason: '',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);

      // Set a timeout to prevent infinite loading
      const timeoutId = setTimeout(() => {
        console.warn('Data loading timeout - clearing loading state');
        setIsLoading(false);
      }, 10000); // 10 second timeout

      const [appointmentsRes, doctorsRes] = await Promise.all([
        appointmentsAPI.list().catch(err => {
          console.error('Failed to load appointments:', err);
          return { data: [] };
        }),
        user?.role === 'patient'
          ? authAPI.listDoctors().catch(err => {
            console.error('Failed to load doctors:', err);
            return { data: [] };
          })
          : Promise.resolve({ data: [] }),
      ]);

      clearTimeout(timeoutId);
      setAppointments(appointmentsRes.data || []);
      setDoctors(doctorsRes.data || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      // Set empty data on error instead of leaving undefined
      setAppointments([]);
      setDoctors([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (new Date(newAppointment.scheduled_time) < new Date()) {
      alert("Cannot schedule appointments in the past");
      return;
    }

    try {
      await appointmentsAPI.create(newAppointment);
      setShowNewAppointment(false);
      setNewAppointment({ doctor_id: '', scheduled_time: '', reason: '', notes: '' });
      loadData();
    } catch (error) {
      console.error('Failed to create appointment:', error);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await appointmentsAPI.update(id, { status });
      loadData();
    } catch (error) {
      console.error('Failed to update appointment:', error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-800 border border-amber-200',
      confirmed: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
      cancelled: 'bg-rose-100 text-rose-800 border border-rose-200',
      completed: 'bg-blue-100 text-blue-800 border border-blue-200',
    };
    return styles[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'confirmed': return <CheckCircle className="w-4 h-4" />;
      case 'cancelled': return <XCircle className="w-4 h-4" />;
      case 'completed': return <FileText className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';
  };

  // Apply status filter
  const filteredAppointments = statusFilter === 'all'
    ? appointments
    : appointments.filter(a => a.status === statusFilter);

  const upcomingAppointments = filteredAppointments
    .filter((a) => a.status === 'confirmed' || a.status === 'pending')
    .sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime());

  const nextAppointment = filteredAppointments
    .filter(a => a.status === 'confirmed' && isFuture(parseISO(a.scheduled_time)))
    .sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime())[0];

  const pastAppointments = filteredAppointments.filter(
    (a) => a.status === 'completed' || a.status === 'cancelled'
  ).sort((a, b) => new Date(b.scheduled_time).getTime() - new Date(a.scheduled_time).getTime());

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium animate-pulse">Loading experience...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Immersive Header with Glassmorphism */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className={`p-2.5 rounded-xl shadow-sm ${user?.role === 'doctor'
              ? 'bg-gradient-to-br from-emerald-100 to-teal-200 text-emerald-700'
              : 'bg-gradient-to-br from-blue-100 to-indigo-200 text-blue-700'
              }`}>
              {user?.role === 'doctor' ? <Stethoscope className="w-6 h-6" /> : <Users className="w-6 h-6" />}
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">CARE Platform</h1>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{user?.role} Portal</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* "New Appointment" for Patient - prominent in header on mobile, standard on desktop */}
            {user?.role === 'patient' && (
              <button
                onClick={() => setShowNewAppointment(true)}
                className="hidden sm:inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm hover:shadow transition-all duration-200 font-medium text-sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Appointment
              </button>
            )}

            <div className="w-px h-8 bg-gray-200 mx-2 hidden sm:block"></div>

            <button onClick={() => setShowHelp(true)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-gray-50 rounded-lg transition-colors" title="Help">
              <HelpCircle className="w-5 h-5" />
            </button>
            <button onClick={loadData} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-gray-50 rounded-lg transition-colors" title="Refresh">
              <RefreshCw className="w-5 h-5" />
            </button>
            <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Logout">
              <LogOut className="w-5 h-5" />
            </button>

            <div className="hidden sm:flex items-center pl-2 ml-2 space-x-3 border-l border-gray-200">
              <div className="text-right hidden md:block">
                <p className="text-sm font-semibold text-gray-900">{user?.full_name}</p>
                <p className="text-xs text-gray-500">{user?.role === 'doctor' ? 'Medical Professional' : 'Patient Account'}</p>
              </div>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-md ${user?.role === 'doctor' ? 'bg-gradient-to-r from-emerald-400 to-teal-500' : 'bg-gradient-to-r from-blue-400 to-indigo-500'
                }`}>
                {getInitials(user?.full_name || '')}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Welcome Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
              {greeting()}, {user?.full_name?.split(' ')[0]}
            </h1>
            <p className="text-gray-500 mt-1 text-lg">
              Here is what's happening today.
            </p>
          </div>
          <div className="flex space-x-3">
            <div className="px-4 py-2 bg-white rounded-lg shadow-sm border border-gray-100 flex items-center text-sm font-medium text-gray-600">
              <Calendar className="w-4 h-4 mr-2 text-indigo-500" />
              {format(new Date(), 'EEEE, MMMM do, yyyy')}
            </div>
          </div>
        </div>

        {/* HERO: Next Appointment Card */}
        {nextAppointment && (
          <div className="transform transition-all active:scale-[0.99] duration-200 animate-in fade-in slide-in-from-bottom-5 delay-75">
            <div className={`rounded-2xl shadow-lg border overflow-hidden relative ${user?.role === 'doctor'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white border-emerald-500'
              : 'bg-gradient-to-r from-indigo-600 to-blue-700 text-white border-indigo-500'
              }`}>
              {/* Decorative circles */}
              <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-white opacity-10 blur-3xl"></div>
              <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-white opacity-10 blur-3xl"></div>

              <div className="relative p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-start space-x-5">
                  <div className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl flex-shrink-0">
                    <Video className="w-10 h-10 text-white" />
                  </div>
                  <div className="text-white">
                    <div className="flex items-center space-x-2 text-white/80 text-sm font-medium mb-1">
                      <span className="bg-white/20 px-2 py-0.5 rounded text-xs uppercase tracking-wider backdrop-blur-md">Up Next</span>
                      <span>•</span>
                      <span>{isToday(parseISO(nextAppointment.scheduled_time)) ? 'Today' : format(parseISO(nextAppointment.scheduled_time), 'EEEE')}</span>
                    </div>
                    <h2 className="text-2xl font-bold mb-2">
                      {user?.role === 'doctor'
                        ? `Consultation with ${nextAppointment.patient?.full_name}`
                        : `Consultation with ${nextAppointment.doctor?.full_name}`
                      }
                    </h2>
                    <div className="flex flex-wrap items-center gap-4 text-white/90">
                      <div className="flex items-center">
                        <Clock className="w-5 h-5 mr-2 opacity-80" />
                        <span className="text-lg font-medium">{format(parseISO(nextAppointment.scheduled_time), 'h:mm a')}</span>
                      </div>
                      <div className="flex items-center">
                        <Info className="w-5 h-5 mr-2 opacity-80" />
                        <span>{nextAppointment.reason}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <Link
                  to={`/interview/${nextAppointment.id}`}
                  className="w-full md:w-auto px-8 py-4 bg-white text-indigo-600 font-bold rounded-xl shadow-xl hover:bg-gray-50 hover:scale-105 transition-all duration-200 flex items-center justify-center whitespace-nowrap group"
                >
                  Join Meeting Room
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid - Enhanced */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-6 delay-100">
          {[
            { label: 'Total Appointments', value: appointments.length, icon: Calendar, ring: 'ring-blue-100', bg: 'bg-blue-50', text: 'text-blue-600' },
            { label: 'Pending Requests', value: appointments.filter(a => a.status === 'pending').length, icon: Clock, ring: 'ring-amber-100', bg: 'bg-amber-50', text: 'text-amber-600' },
            { label: 'Confirmed', value: appointments.filter(a => a.status === 'confirmed').length, icon: CheckCircle, ring: 'ring-emerald-100', bg: 'bg-emerald-50', text: 'text-emerald-600' },
            { label: 'Completed', value: appointments.filter(a => a.status === 'completed').length, icon: FileText, ring: 'ring-purple-100', bg: 'bg-purple-50', text: 'text-purple-600' },
          ].map((stat, idx) => (
            <div key={idx} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200 group">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">{stat.label}</p>
                  <p className="text-3xl font-bold text-gray-900 group-hover:scale-110 origin-left transition-transform duration-200">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-xl ${stat.bg} ${stat.text} group-hover:ring-2 ring-offset-2 ${stat.ring} transition-all`}>
                  <stat.icon className="w-6 h-6" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Split View */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main List Column */}
          <div className="lg:col-span-2 space-y-6 animate-in fade-in slide-in-from-bottom-7 delay-150">

            {/* Upcoming List */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-indigo-50 rounded-lg">
                      <Bell className="w-5 h-5 text-indigo-600" />
                    </div>
                    <h2 className="text-lg font-bold text-gray-900">Upcoming Schedule</h2>
                  </div>
                  {upcomingAppointments.length > 0 && (
                    <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full uppercase tracking-wide">
                      {upcomingAppointments.length} Active
                    </span>
                  )}
                </div>

                {/* Filter Buttons */}
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'all', label: 'All', icon: Calendar },
                    { value: 'pending', label: 'Pending', icon: Clock },
                    { value: 'confirmed', label: 'Confirmed', icon: CheckCircle },
                    { value: 'completed', label: 'Completed', icon: FileText },
                    { value: 'cancelled', label: 'Cancelled', icon: XCircle },
                  ].map((filter) => (
                    <button
                      key={filter.value}
                      onClick={() => setStatusFilter(filter.value)}
                      className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${statusFilter === filter.value
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                      <filter.icon className="w-4 h-4 mr-2" />
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              {upcomingAppointments.length === 0 ? (
                <div className="p-12 text-center bg-gray-50/50">
                  <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce-slow">
                    <Calendar className="w-10 h-10 text-indigo-300" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">No active appointments</h3>
                  <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                    {user?.role === 'patient'
                      ? "Your health journey starts here. Schedule your first consultation today."
                      : "You have no upcoming patient consultations scheduled."
                    }
                  </p>
                  {user?.role === 'patient' && (
                    <button
                      onClick={() => setShowNewAppointment(true)}
                      className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg font-medium"
                    >
                      <Plus className="w-5 h-5 mr-2" />
                      Book Now
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {upcomingAppointments.map((appointment) => (
                    <div key={appointment.id} className="p-6 hover:bg-gray-50 transition-colors duration-200 group">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start space-x-4">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${user?.role === 'doctor' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'
                            }`}>
                            {user?.role === 'doctor' ? <Users className="w-6 h-6" /> : <Stethoscope className="w-6 h-6" />}
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <h4 className="font-bold text-gray-900 text-lg">
                                {user?.role === 'doctor'
                                  ? appointment.patient?.full_name || 'Patient'
                                  : appointment.doctor?.full_name || 'Doctor'}
                              </h4>
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadge(appointment.status)} flex items-center gap-1`}>
                                {getStatusIcon(appointment.status)}
                                <span className="capitalize">{appointment.status}</span>
                              </span>
                            </div>

                            <p className="text-gray-600 font-medium mb-1">{appointment.reason}</p>

                            <div className="flex items-center text-sm text-gray-500 space-x-4">
                              <span className="flex items-center">
                                <Clock className="w-4 h-4 mr-1.5" />
                                {format(parseISO(appointment.scheduled_time), 'MMM d, h:mm a')}
                              </span>
                              {isToday(parseISO(appointment.scheduled_time)) && (
                                <span className="text-indigo-600 font-semibold text-xs bg-indigo-50 px-2 py-0.5 rounded">
                                  Today
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3 sm:self-center self-end">
                          {/* Doctor Actions */}
                          {appointment.status === 'pending' && user?.role === 'doctor' && (
                            <>
                              <button
                                onClick={() => handleUpdateStatus(appointment.id, 'confirmed')}
                                className="p-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors"
                                title="Approve"
                              >
                                <CheckCircle className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(appointment.id, 'cancelled')}
                                className="p-2 bg-rose-100 text-rose-700 rounded-lg hover:bg-rose-200 transition-colors"
                                title="Decline"
                              >
                                <XCircle className="w-5 h-5" />
                              </button>
                            </>
                          )}

                          {appointment.status === 'confirmed' && (
                            <Link
                              to={`/interview/${appointment.id}`}
                              className="inline-flex items-center px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 hover:text-indigo-600 hover:border-indigo-200 transition-all font-medium text-sm shadow-sm"
                            >
                              <Video className="w-4 h-4 mr-2" />
                              Details
                            </Link>
                          )}
                        </div>
                      </div>

                      {/* Contextual Status Message */}
                      {appointment.status === 'pending' && user?.role === 'patient' && (
                        <div className="mt-3 ml-16 text-sm text-amber-700 bg-amber-50/50 p-2 rounded border border-amber-100/50 flex items-center">
                          <Clock className="w-3.5 h-3.5 mr-2" />
                          Waiting for doctor approval. You will be notified once confirmed.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Past Appointments (Collapsed/Simplified) */}
            {pastAppointments.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex items-center space-x-2">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <RefreshCw className="w-5 h-5 text-gray-600" />
                  </div>
                  <h2 className="text-lg font-bold text-gray-900">History</h2>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {pastAppointments.map((appointment) => (
                    <div key={appointment.id} className="p-4 hover:bg-gray-50 transition border-b border-gray-50 last:border-0 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
                          <Users className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {user?.role === 'doctor' ? appointment.patient?.full_name : appointment.doctor?.full_name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {format(parseISO(appointment.scheduled_time), 'MMM d, yyyy • h:mm a')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs px-2 py-1 rounded-full capitalize font-medium ${appointment.status === 'completed' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                          }`}>
                          {appointment.status}
                        </span>
                        {appointment.status === 'completed' && (
                          <Link to={`/interview/${appointment.id}`} className="text-gray-400 hover:text-indigo-600">
                            <ArrowRight className="w-4 h-4" />
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Area */}
          <div className="space-y-6 animate-in fade-in slide-in-from-right-8 delay-200">
            {/* Quick Guide */}
            <div className={`rounded-2xl p-6 shadow-sm border ${user?.role === 'doctor' ? 'bg-emerald-50 border-emerald-100' : 'bg-blue-50 border-blue-100'}`}>
              <div className="flex items-center space-x-3 mb-4">
                <div className={`p-2 rounded-lg ${user?.role === 'doctor' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                  <Info className="w-5 h-5" />
                </div>
                <h3 className={`font-bold ${user?.role === 'doctor' ? 'text-emerald-900' : 'text-blue-900'}`}>Quick Tips</h3>
              </div>
              <ul className={`space-y-3 text-sm ${user?.role === 'doctor' ? 'text-emerald-800' : 'text-blue-800'}`}>
                {user?.role === 'doctor' ? (
                  <>
                    <li className="flex items-start gap-2"><div className="w-1.5 h-1.5 mt-1.5 rounded-full bg-emerald-500 flex-shrink-0" />Review pending requests daily to keep your schedule accurate.</li>
                    <li className="flex items-start gap-2"><div className="w-1.5 h-1.5 mt-1.5 rounded-full bg-emerald-500 flex-shrink-0" />Join calls 5 minutes early to test your audio and video.</li>
                  </>
                ) : (
                  <>
                    <li className="flex items-start gap-2"><div className="w-1.5 h-1.5 mt-1.5 rounded-full bg-blue-500 flex-shrink-0" />Join the video room 5 min before your scheduled time.</li>
                    <li className="flex items-start gap-2"><div className="w-1.5 h-1.5 mt-1.5 rounded-full bg-blue-500 flex-shrink-0" />Ensure you are in a quiet environment for the best experience.</li>
                  </>
                )}
              </ul>
            </div>

            {/* Action Banner (Mobile Only, usually) or Promo */}
            {user?.role === 'patient' && (
              <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden group hover:shadow-xl transition-all cursor-pointer" onClick={() => setShowNewAppointment(true)}>
                <div className="absolute right-0 top-0 opacity-10 transform translate-x-10 -translate-y-10 group-hover:scale-110 transition-transform duration-500">
                  <Calendar className="w-40 h-40" />
                </div>
                <div className="relative z-10">
                  <h3 className="font-bold text-xl mb-2">Need a checkup?</h3>
                  <p className="text-purple-100 mb-4 text-sm">Our doctors are available for consultations. Schedule one now.</p>
                  <button className="bg-white text-indigo-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-opacity-90 transition shadow-sm">
                    Book Appointment
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* New Appointment Modal Overlay */}
      {showNewAppointment && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl transform transition-all scale-100 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">📅 Schedule New Appointment</h2>
                <p className="text-sm text-gray-600 mt-1">Book a consultation with an available doctor</p>
              </div>
              <button
                onClick={() => setShowNewAppointment(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCreateAppointment} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Doctor <span className="text-rose-500">*</span>
                </label>
                <select
                  value={newAppointment.doctor_id}
                  onChange={(e) => setNewAppointment({ ...newAppointment, doctor_id: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                  required
                >
                  <option value="">Choose a doctor...</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      👨‍⚕️ {doctor.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Preferred Date & Time <span className="text-rose-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={newAppointment.scheduled_time}
                  min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                  onChange={(e) => setNewAppointment({ ...newAppointment, scheduled_time: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for Visit <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newAppointment.reason}
                  onChange={(e) => setNewAppointment({ ...newAppointment, reason: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                  placeholder="e.g., Regular checkup, Follow-up visit"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Notes <span className="text-gray-400">(Optional)</span>
                </label>
                <textarea
                  value={newAppointment.notes}
                  onChange={(e) => setNewAppointment({ ...newAppointment, notes: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                  rows={3}
                  placeholder="Any additional information..."
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewAppointment(false)}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-md hover:shadow-lg font-medium transition"
                >
                  Book Appointment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">📖 Help & Guide</h2>
              <button
                onClick={() => setShowHelp(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <XCircle className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {user?.role === 'patient' ? (
              <div className="space-y-6">
                <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                  <h4 className="font-bold text-indigo-900 mb-2">How to join a consultation?</h4>
                  <p className="text-sm text-indigo-800">
                    Once your appointment is confirmed by the doctor, you will see a large "Join Meeting Room" button on your dashboard. Click it at the scheduled time to enter waiting room.
                  </p>
                </div>
                {/* ... content simplified for brevity since it's just text ... */}
                <p className="text-gray-600">
                  For technical support, please contact support@careplatform.com
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                  <h4 className="font-bold text-emerald-900 mb-2">Managing Appointments</h4>
                  <p className="text-sm text-emerald-800">
                    Use the green Check and red X buttons to confirm or decline appointment requests. Confirmed appointments will appear in your "Upcoming Schedule".
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowHelp(false)}
              className="w-full mt-6 px-4 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 font-medium transition"
            >
              Close Guide
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
