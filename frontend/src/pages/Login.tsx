import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Stethoscope, 
  Mail, 
  Lock, 
  Heart, 
  Shield, 
  Video, 
  ClipboardCheck,
  UserCog,
  Users,
  ArrowRight
} from 'lucide-react';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'doctor' | 'patient'>('patient');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const fillDemoCredentials = (type: 'doctor' | 'patient') => {
    if (type === 'doctor') {
      setEmail('dr.smith@hospital.com');
      setPassword('doctor123');
    } else {
      setEmail('patient1@email.com');
      setPassword('patient123');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Hero Section */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-600 rounded-xl">
                <Stethoscope className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">CARE Platform</h1>
                <p className="text-sm text-gray-500">Secure Medical Consultations</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Side - Info */}
          <div className="space-y-8">
            <div>
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Doctor-Patient <span className="text-blue-600">Video Consultation</span> Platform
              </h2>
              <p className="text-xl text-gray-600">
                Secure, HIPAA-compliant video consultations with consent management, 
                recording, and automatic transcription.
              </p>
            </div>

            {/* Features */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
                  <Video className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">HD Video Calls</h3>
                <p className="text-sm text-gray-600">Real-time video consultations with crystal clear quality</p>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mb-3">
                  <ClipboardCheck className="w-5 h-5 text-green-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Consent Management</h3>
                <p className="text-sm text-gray-600">Secure patient consent before any recording</p>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-3">
                  <Shield className="w-5 h-5 text-purple-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">HIPAA Compliant</h3>
                <p className="text-sm text-gray-600">All data encrypted and securely stored</p>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center mb-3">
                  <Heart className="w-5 h-5 text-orange-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Auto Transcription</h3>
                <p className="text-sm text-gray-600">AI-powered transcription of consultations</p>
              </div>
            </div>

            {/* How it works */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white">
              <h3 className="font-bold text-lg mb-4">📋 How It Works</h3>
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-sm font-bold">1</span>
                  <div>
                    <p className="font-medium">Patient books an appointment</p>
                    <p className="text-sm text-blue-100">Choose a doctor and preferred time slot</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-sm font-bold">2</span>
                  <div>
                    <p className="font-medium">Doctor confirms the appointment</p>
                    <p className="text-sm text-blue-100">Review patient details and approve</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-sm font-bold">3</span>
                  <div>
                    <p className="font-medium">Join the video consultation</p>
                    <p className="text-sm text-blue-100">Secure video call with recording option</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Login Form */}
          <div className="bg-white rounded-2xl shadow-xl p-8">
            {/* Role Tabs */}
            <div className="flex mb-6 p-1 bg-gray-100 rounded-xl">
              <button
                onClick={() => setActiveTab('patient')}
                className={`flex-1 flex items-center justify-center space-x-2 py-3 rounded-lg font-medium transition ${
                  activeTab === 'patient' 
                    ? 'bg-white shadow-sm text-blue-600' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Users className="w-5 h-5" />
                <span>I'm a Patient</span>
              </button>
              <button
                onClick={() => setActiveTab('doctor')}
                className={`flex-1 flex items-center justify-center space-x-2 py-3 rounded-lg font-medium transition ${
                  activeTab === 'doctor' 
                    ? 'bg-white shadow-sm text-blue-600' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <UserCog className="w-5 h-5" />
                <span>I'm a Doctor</span>
              </button>
            </div>

            {/* Role-specific instructions */}
            <div className={`mb-6 p-4 rounded-xl ${activeTab === 'patient' ? 'bg-blue-50 border border-blue-100' : 'bg-green-50 border border-green-100'}`}>
              {activeTab === 'patient' ? (
                <div className="text-sm">
                  <p className="font-semibold text-blue-900 mb-2">👤 Patient Portal</p>
                  <ul className="text-blue-800 space-y-1">
                    <li>• Book appointments with available doctors</li>
                    <li>• Manage multiple appointments</li>
                    <li>• Join video consultations</li>
                    <li>• Grant consent for recording</li>
                  </ul>
                </div>
              ) : (
                <div className="text-sm">
                  <p className="font-semibold text-green-900 mb-2">👨‍⚕️ Doctor Portal</p>
                  <ul className="text-green-800 space-y-1">
                    <li>• View your patient appointments</li>
                    <li>• Confirm or reschedule bookings</li>
                    <li>• Conduct video consultations</li>
                    <li>• Request consent & record sessions</li>
                  </ul>
                </div>
              )}
            </div>

            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Welcome Back</h2>
              <p className="text-gray-600 mt-1">Sign in to continue to your dashboard</p>
            </div>

            {error && (
              <div 
                id="login-error"
                role="alert"
                className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="you@example.com"
                    required
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? "login-error" : undefined}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="••••••••"
                    required
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? "login-error" : undefined}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition duration-200 disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                <span>{isLoading ? 'Signing in...' : 'Sign In'}</span>
                {!isLoading && <ArrowRight className="w-5 h-5" />}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-gray-600">
                Don't have an account?{' '}
                <Link to="/register" className="text-blue-600 hover:text-blue-700 font-medium">
                  Sign up
                </Link>
              </p>
            </div>

            {/* Demo Accounts */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-700 text-center mb-4">🔐 Quick Demo Access</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => fillDemoCredentials('doctor')}
                  className="p-3 bg-green-50 hover:bg-green-100 border border-green-200 rounded-xl text-left transition group"
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <UserCog className="w-4 h-4 text-green-600" />
                    <p className="font-semibold text-green-900 text-sm">Doctor Login</p>
                  </div>
                  <p className="text-xs text-green-700">dr.smith@hospital.com</p>
                  <p className="text-xs text-green-600 mt-1 group-hover:underline">Click to fill →</p>
                </button>
                <button
                  type="button"
                  onClick={() => fillDemoCredentials('patient')}
                  className="p-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl text-left transition group"
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <Users className="w-4 h-4 text-blue-600" />
                    <p className="font-semibold text-blue-900 text-sm">Patient Login</p>
                  </div>
                  <p className="text-xs text-blue-700">patient1@email.com</p>
                  <p className="text-xs text-blue-600 mt-1 group-hover:underline">Click to fill →</p>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row justify-between items-center">
            <p className="text-sm text-gray-500">© 2026 CARE Platform. Secure Medical Consultations.</p>
            <div className="flex items-center space-x-4 mt-4 sm:mt-0">
              <span className="flex items-center text-sm text-gray-500">
                <Shield className="w-4 h-4 mr-1 text-green-500" />
                HIPAA Compliant
              </span>
              <span className="flex items-center text-sm text-gray-500">
                <Lock className="w-4 h-4 mr-1 text-blue-500" />
                256-bit Encryption
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Login;
