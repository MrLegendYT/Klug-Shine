import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { HashRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { 
  Home as HomeIcon, PlayCircle, ThumbsUp, User as UserIcon, LogOut, 
  X, Coins, TrendingUp, ShieldCheck, ExternalLink, AlertCircle, Mail, Key, Youtube, BarChart3, RefreshCw, LayoutGrid, ArrowRight, SkipForward, Loader2, Sparkles, Check, Upload, Image as ImageIcon
} from 'lucide-react';
import { auth, db, API_KEY, increment } from './services/firebase';

import { UserProfile, Task, TaskType, Campaign } from './types';
import { verifyTaskCompletion } from './services/mockBackend';

// --- Error Boundary ---

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-4">
          <div className="bg-red-900/20 border border-red-500 rounded-2xl p-8 max-w-lg text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
            <p className="text-slate-300 mb-4 text-sm">Please refresh the page or try again later.</p>
            <pre className="bg-black/50 p-4 rounded text-left text-xs font-mono overflow-auto max-h-40 text-red-300">
              {this.state.error?.toString()}
            </pre>
            <button 
              onClick={() => window.location.reload()}
              className="mt-6 bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded-lg font-bold transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Utilities ---

const IMGBB_API_KEY = "3a8b3803786a5a839b54dd4a040fbc3d";

const uploadToImgBB = async (file: File): Promise<string | null> => {
  const formData = new FormData();
  formData.append("image", file);
  try {
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
      method: "POST",
      body: formData,
    });
    const data = await response.json();
    if (data.success) {
      return data.data.url;
    }
  } catch (error) {
    console.error("ImgBB Upload Error", error);
  }
  return null;
};

// --- Components ---

const LoginModal = ({ isOpen, onClose, onLoginSuccess }: { isOpen: boolean; onClose: () => void; onLoginSuccess: (user: UserProfile) => void }) => {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [channelName, setChannelName] = useState('');
  const [channelId, setChannelId] = useState('');
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState<{title: string, message: string} | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProfileImage(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setStatusMsg('');

    try {
      if (isSignup) {
        if (password.length < 6) throw new Error("Password must be at least 6 characters");
        if (!profileImage) throw new Error("Please upload a profile picture.");
        if (!channelName.trim()) throw new Error("Please enter your Channel Name.");

        // 1. Upload Image
        setStatusMsg('Uploading Profile Picture...');
        const photoURL = await uploadToImgBB(profileImage);
        if (!photoURL) throw new Error("Failed to upload image. Please try again.");

        // 2. Create Auth User
        setStatusMsg('Creating Account...');
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        if (!user) throw new Error("Failed to create user");

        // 3. Update Profile
        await user.updateProfile({
          displayName: channelName,
          photoURL: photoURL
        });

        // 4. Create Firestore Doc
        const newUser: UserProfile = {
          uid: user.uid,
          displayName: channelName,
          email: user.email,
          photoURL: photoURL,
          points: 10,
          tasksCompleted: 0,
          questCredits: 0,
          role: 'user',
          superTasksCompletedToday: 0,
          lastSuperTaskDate: new Date().toISOString().split('T')[0],
          channelId: channelId.trim(),
          handle: `@${channelName.replace(/\s+/g, '').toLowerCase()}`,
          subscriberCount: 0
        };
        
        await db.collection('users').doc(user.uid).set(newUser);
        onLoginSuccess(newUser);
      } else {
        // Login Flow
        setStatusMsg('Signing In...');
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;

        if (!user) throw new Error("Failed to sign in");

        const userSnap = await db.collection('users').doc(user.uid).get();

        if (userSnap.exists) {
          onLoginSuccess(userSnap.data() as UserProfile);
        } else {
          throw new Error("User profile not found. Please sign up.");
        }
      }
      onClose();
    } catch (err: any) {
      console.error("Auth Error", err);
      let msg = err.message;
      if (err.code === 'auth/email-already-in-use') msg = "Email is already registered.";
      if (err.code === 'auth/wrong-password') msg = "Incorrect password.";
      setError({
        title: isSignup ? "Sign Up Failed" : "Login Failed",
        message: msg
      });
    } finally {
      setLoading(false);
      setStatusMsg('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 max-w-md w-full p-6 relative overflow-hidden max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
          <X className="h-6 w-6" />
        </button>
        
        <div className="text-center mb-6">
          <div className="mx-auto w-14 h-14 bg-gradient-to-br from-brand-300 to-brand-500 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-brand-500/20">
            <UserIcon className="h-7 w-7 text-slate-900" />
          </div>
          <h2 className="text-2xl font-bold text-white">{isSignup ? 'Join Klug Shine' : 'Welcome Back'}</h2>
          <p className="text-slate-400 mt-2 text-sm">
            {isSignup ? 'Start growing your channel today' : 'Sign in to continue earning'}
          </p>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-4 mb-6 flex gap-3 items-start">
            <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-red-400">{error.title}</h4>
              <p className="text-xs text-red-300/80 mt-1">{error.message}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          {isSignup && (
            <>
               <div className="flex flex-col items-center mb-4">
                <label className="relative cursor-pointer group">
                  <div className={`w-24 h-24 rounded-full border-2 flex items-center justify-center overflow-hidden ${previewUrl ? 'border-brand-500' : 'border-dashed border-slate-600 bg-slate-900 hover:border-brand-400'}`}>
                    {previewUrl ? (
                      <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center">
                        <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1 group-hover:text-brand-400" />
                        <span className="text-[9px] text-slate-500 uppercase font-bold">Upload Pic</span>
                      </div>
                    )}
                  </div>
                  <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                  {previewUrl && (
                    <div className="absolute bottom-0 right-0 bg-brand-500 text-slate-900 rounded-full p-1.5 shadow-lg border border-slate-800">
                      <ImageIcon className="w-3 h-3" />
                    </div>
                  )}
                </label>
                <span className="text-xs text-slate-500 mt-2">Tap to upload channel icon</span>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 ml-1">Channel Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                  <input 
                    type="text" 
                    placeholder="My Awesome Channel" 
                    value={channelName}
                    onChange={(e) => setChannelName(e.target.value)}
                    className="block w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-600 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 ml-1">Channel ID (Optional)</label>
                <div className="relative">
                  <Youtube className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                  <input 
                    type="text" 
                    placeholder="UC..." 
                    value={channelId}
                    onChange={(e) => setChannelId(e.target.value)}
                    className="block w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-600 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all font-mono text-sm"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 ml-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
              <input 
                type="email" 
                placeholder="name@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-600 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all text-sm"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 ml-1">Password</label>
            <div className="relative">
              <Key className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
              <input 
                type="password" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-600 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all text-sm"
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-gradient-to-r from-brand-300 via-brand-500 to-amber-600 text-slate-900 font-bold py-3.5 rounded-xl hover:shadow-lg hover:shadow-brand-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? (statusMsg || 'Processing...') : (isSignup ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-700/50 text-center">
          <p className="text-slate-400 text-sm">
            {isSignup ? "Already have an account?" : "Don't have an account?"}
            <button 
              onClick={() => {
                setIsSignup(!isSignup);
                setError(null);
                setPreviewUrl(null);
                setProfileImage(null);
              }}
              className="ml-2 text-brand-400 font-bold hover:text-brand-300 transition-colors"
            >
              {isSignup ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

// Top Navbar - Now only visible on Mobile/Tablet (< lg)
const Navbar = ({ user, points, onLoginClick }: { user: UserProfile | null, points: number, onLoginClick: () => void }) => {
  return (
    <nav className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-white/5 shadow-lg safe-area-top lg:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex-shrink-0 flex items-center gap-2 group">
              <div className="w-9 h-9 bg-gradient-to-br from-brand-300 to-brand-500 rounded-xl flex items-center justify-center text-slate-900 font-bold shadow-lg shadow-brand-500/20 group-hover:scale-105 transition-transform">K</div>
              <span className="font-bold text-xl tracking-tight text-white hidden sm:block">Klug <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-300 to-amber-500">Shine</span></span>
              <span className="font-bold text-xl tracking-tight text-white sm:hidden">Klug</span>
            </Link>
          </div>
          
          <div className="flex items-center gap-3 sm:gap-4">
            {user ? (
              <>
                <div className="flex items-center bg-slate-900 px-3 sm:px-4 py-1.5 rounded-full border border-slate-800 shadow-inner">
                  <Coins className="w-4 h-4 text-brand-400 mr-2" />
                  <span className="font-bold text-brand-100">{points}</span>
                </div>
                <div className="lg:hidden">
                    <button onClick={() => auth.signOut()} className="text-slate-400 hover:text-white transition-colors">
                        <LogOut className="h-6 w-6" />
                    </button>
                </div>
              </>
            ) : (
              <button 
                onClick={onLoginClick}
                className="bg-slate-800 hover:bg-slate-700 text-white px-4 sm:px-5 py-2 rounded-lg text-sm font-medium transition-all border border-slate-700 hover:border-slate-600"
              >
                Login
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

// Bottom Nav - Mobile/Tablet only (< lg)
const BottomNav = ({ user, onLoginClick }: { user: UserProfile | null, onLoginClick: () => void }) => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 pb-safe z-50">
      <div className="flex justify-around items-center h-20 pb-2">
        <Link 
          to="/" 
          className={`flex flex-col items-center justify-center w-full h-full space-y-1.5 ${isActive('/') ? 'text-brand-400' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <HomeIcon className={`h-7 w-7 ${isActive('/') ? 'fill-current bg-brand-400/10 rounded-xl p-0.5' : ''}`} />
          <span className="text-[10px] font-bold">Home</span>
        </Link>
        <Link 
          to="/earn" 
          className={`flex flex-col items-center justify-center w-full h-full space-y-1.5 ${isActive('/earn') ? 'text-brand-400' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <PlayCircle className={`h-7 w-7 ${isActive('/earn') ? 'fill-current' : ''}`} />
          <span className="text-[10px] font-bold">Earn</span>
        </Link>
        <Link 
          to="/promote" 
          className={`flex flex-col items-center justify-center w-full h-full space-y-1.5 ${isActive('/promote') ? 'text-brand-400' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <TrendingUp className={`h-7 w-7 ${isActive('/promote') ? 'fill-current' : ''}`} />
          <span className="text-[10px] font-bold">Promote</span>
        </Link>
        
        {user ? (
          <button 
            onClick={() => auth.signOut()} 
            className="flex flex-col items-center justify-center w-full h-full space-y-1.5 text-slate-500 hover:text-red-400 transition-colors"
          >
             <LogOut className="h-7 w-7" />
             <span className="text-[10px] font-bold">Logout</span>
          </button>
        ) : (
          <button 
            onClick={onLoginClick}
            className="flex flex-col items-center justify-center w-full h-full space-y-1.5 text-slate-500 hover:text-slate-300"
          >
            <UserIcon className="h-7 w-7" />
            <span className="text-[10px] font-bold">Login</span>
          </button>
        )}
      </div>
    </div>
  );
};

// Sidebar Nav - Desktop Only (>= lg)
const SidebarNav = ({ user, points, onLoginClick }: { user: UserProfile | null, points: number, onLoginClick: () => void }) => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  const NavItem = ({ to, icon, label }: { to: string, icon: React.ReactNode, label: string }) => (
    <Link to={to} className="relative group w-12 h-12 flex items-center justify-center rounded-xl transition-all hover:bg-white/10">
      <div className={`${isActive(to) ? 'text-brand-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]' : 'text-slate-400 group-hover:text-white'}`}>
        {icon}
      </div>
      {isActive(to) && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-brand-500 rounded-r-full shadow-[0_0_10px_rgba(245,158,11,0.5)]"></div>
      )}
      <div className="absolute left-14 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none text-xs font-bold text-white">
        {label}
      </div>
    </Link>
  );

  return (
    <div className="hidden lg:flex fixed left-0 top-0 h-screen w-20 flex-col items-center bg-slate-900/95 backdrop-blur-md border-r border-slate-800 z-50 py-6">
      <Link to="/" className="mb-8 w-10 h-10 bg-gradient-to-br from-brand-300 to-brand-500 rounded-xl flex items-center justify-center text-slate-900 font-bold text-lg shadow-lg shadow-brand-500/20 hover:scale-105 transition-transform">
        K
      </Link>

      <div className="flex-1 flex flex-col gap-4 w-full items-center">
        <NavItem to="/" icon={<LayoutGrid className="w-6 h-6" />} label="Dashboard" />
        <NavItem to="/earn" icon={<PlayCircle className="w-6 h-6" />} label="Earn Points" />
        <NavItem to="/promote" icon={<TrendingUp className="w-6 h-6" />} label="Promote" />
      </div>

      <div className="flex flex-col gap-6 items-center w-full mb-2">
        {user && (
          <div className="relative group flex flex-col items-center">
             <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-brand-400 group-hover:border-brand-500/50 transition-colors shadow-[0_0_15px_rgba(245,158,11,0.1)]">
               <Coins className="w-5 h-5" />
             </div>
             <span className="text-[10px] font-bold text-brand-100 mt-1">{points}</span>
             <div className="absolute left-14 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none text-xs font-bold text-white top-2">
                Balance: {points} Pts
             </div>
          </div>
        )}

        {user ? (
          <button onClick={() => auth.signOut()} className="relative group w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center hover:bg-slate-700 transition-colors">
             <LogOut className="w-5 h-5 text-slate-400 group-hover:text-red-400" />
             <div className="absolute left-14 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none text-xs font-bold text-white top-2">
                Sign Out
             </div>
          </button>
        ) : (
          <button onClick={onLoginClick} className="relative group w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center hover:bg-slate-700 transition-colors">
             <UserIcon className="w-5 h-5 text-slate-400 group-hover:text-white" />
             <div className="absolute left-14 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none text-xs font-bold text-white top-2">
                Sign In
             </div>
          </button>
        )}
      </div>
    </div>
  );
};

const TaskCard: React.FC<{ 
  task: Task; 
  onComplete?: (task: Task) => Promise<void>; 
  readOnly?: boolean; 
  stats?: {filled: number, total: number};
  statusLabel?: string;
}> = ({ task, onComplete, readOnly, stats, statusLabel }) => {
  const [status, setStatus] = useState<'idle' | 'verifying' | 'completed'>('idle');

  const handleAction = async () => {
    if (readOnly) return;
    window.open(task.url, '_blank');
    setStatus('verifying');
  };

  const handleVerify = async () => {
    if (readOnly || !onComplete) return;
    try {
      await onComplete(task);
      setStatus('completed');
    } catch (error) {
      alert("Verification failed! Did you actually complete the task?");
      setStatus('idle');
    }
  };

  return (
    <div className={`group bg-slate-800/40 overflow-hidden shadow-lg rounded-2xl border transition-all duration-300 ${readOnly ? 'border-brand-500/20 bg-brand-900/5' : 'border-slate-700/50 hover:border-brand-500/30 hover:bg-slate-800/80 hover:shadow-brand-500/5'}`}>
      <div className="p-4 sm:p-5">
        <div className="flex items-center gap-4 sm:gap-5">
          <div className="flex-shrink-0 relative">
            {task.thumbnailUrl ? (
              <img className="h-14 w-14 sm:h-16 sm:w-16 object-cover rounded-full ring-2 ring-slate-700 group-hover:ring-brand-500/50 transition-all shadow-lg" src={task.thumbnailUrl} alt="" />
            ) : (
              <div className={`h-12 w-12 sm:h-14 sm:w-14 rounded-2xl flex items-center justify-center shadow-inner ${task.type === TaskType.LIKE ? 'bg-red-500/10 text-red-500' : task.type === TaskType.SUBSCRIBE ? 'bg-slate-700/50 text-slate-300' : 'bg-blue-500/10 text-blue-400'}`}>
                {task.type === TaskType.LIKE && <ThumbsUp className="h-6 w-6 sm:h-7 sm:w-7" />}
                {task.type === TaskType.SUBSCRIBE && <UserIcon className="h-6 w-6 sm:h-7 sm:w-7" />}
                {task.type === TaskType.WATCH && <PlayCircle className="h-6 w-6 sm:h-7 sm:w-7" />}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
               <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                 task.type === 'LIKE' ? 'border-red-900/50 bg-red-900/10 text-red-400' :
                 task.type === 'SUBSCRIBE' ? 'border-slate-600 bg-slate-700/30 text-slate-300' :
                 task.type === 'WATCH' ? 'border-blue-900/50 bg-blue-900/10 text-blue-400' :
                 'border-amber-500/30 bg-amber-500/10 text-amber-400'
               }`}>
                 {task.type}
               </span>
               {task.channelName && <span className="text-xs text-brand-400 truncate hidden sm:inline">• {task.channelName}</span>}
            </div>
            <h3 className="text-sm sm:text-base font-bold text-slate-100 truncate pr-2">{task.title}</h3>
            {readOnly && (
               <p className="text-xs text-brand-400 mt-0.5">My Campaign</p>
            )}
          </div>
        </div>
      </div>
      <div className="bg-slate-900/30 px-4 sm:px-5 py-3 border-t border-slate-700/50 flex justify-between items-center">
        {!readOnly ? (
          <div className="text-sm font-bold text-brand-400 flex items-center bg-brand-500/5 px-2.5 py-1 rounded-lg border border-brand-500/10">
            <Coins className="h-4 w-4 mr-1.5" />
            +{task.reward}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <BarChart3 className="h-3.5 w-3.5" />
            <span>Progress: {stats?.filled} / {stats?.total}</span>
          </div>
        )}
        
        {!readOnly && (
          <>
            {status === 'idle' && (
              <button onClick={handleAction} className="bg-slate-700 text-slate-200 border border-slate-600/50 px-4 sm:px-5 py-1.5 rounded-lg text-xs sm:text-sm font-bold hover:bg-slate-600 hover:text-white transition-colors">
                Start Task
              </button>
            )}
            {status === 'verifying' && (
              <button onClick={handleVerify} className="bg-gradient-to-r from-brand-500 to-amber-600 text-slate-900 px-4 sm:px-5 py-1.5 rounded-lg text-xs sm:text-sm font-bold hover:from-brand-400 hover:to-amber-500 animate-pulse shadow-lg shadow-brand-500/20">
              Verify
            </button>
            )}
            {status === 'completed' && (
              <span className="text-emerald-400 text-xs sm:text-sm font-bold flex items-center bg-emerald-900/20 px-3 py-1 rounded-lg border border-emerald-500/20">
                <ShieldCheck className="h-4 w-4 mr-1.5" /> Done
              </span>
            )}
          </>
        )}
        
        {readOnly && (
           <span className={`text-xs font-bold px-3 py-1 rounded border ${statusLabel === 'completed' ? 'text-emerald-400 bg-emerald-900/20 border-emerald-500/20' : 'text-slate-500 bg-slate-800 border-slate-700'}`}>
             {statusLabel === 'completed' ? 'Completed' : 'Active'}
           </span>
        )}
      </div>
      {readOnly && stats && (
         <div className="h-1 w-full bg-slate-800">
            <div className={`h-full transition-all shadow-[0_0_10px_rgba(245,158,11,0.5)] ${statusLabel === 'completed' ? 'bg-emerald-500' : 'bg-brand-500'}`} style={{ width: `${Math.min((stats.filled / stats.total) * 100, 100)}%` }}></div>
         </div>
      )}
    </div>
  );
};

// --- Pages ---

const LandingPage = ({ onLoginClick }: { onLoginClick: () => void }) => {
  return (
    <div className="min-h-[80vh] flex flex-col justify-center items-center text-center px-4 relative pb-20 overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-500/10 rounded-full blur-[120px] pointer-events-none"></div>
      
      <div className="relative z-10 max-w-4xl mx-auto">
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold text-white tracking-tight mb-6 sm:mb-8 leading-tight">
          Let Your Channel <br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-300 via-brand-500 to-amber-600 animate-pulse">Shine Bright</span>
        </h1>
        <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 sm:mb-12 leading-relaxed px-4">
          The premium exchange platform. Earn gold points by supporting other creators, 
          then use them to make your content shine.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20 px-4 w-full sm:w-auto">
          <button 
            onClick={onLoginClick}
            className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-brand-300 to-brand-500 text-slate-900 text-lg font-bold rounded-xl shadow-xl shadow-brand-500/20 hover:scale-105 transition-all duration-300 border border-brand-400/20"
          >
            Start Shining
          </button>
        </div>
        
        <div id="how-it-works" className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 w-full text-left px-4">
          <div className="p-6 sm:p-8 bg-slate-900/60 backdrop-blur-sm rounded-3xl border border-slate-800 hover:border-brand-500/30 transition-colors group">
            <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center mb-6 text-brand-400 group-hover:text-brand-300 transition-colors shadow-inner">
              <PlayCircle className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-xl text-white mb-3">1. Watch & Earn</h3>
            <p className="text-slate-400 leading-relaxed text-sm sm:text-base">View content from fellow creators and get rewarded with gold points.</p>
          </div>
          <div className="p-6 sm:p-8 bg-slate-900/60 backdrop-blur-sm rounded-3xl border border-slate-800 hover:border-amber-500/30 transition-colors group">
            <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center mb-6 text-amber-400 group-hover:text-amber-300 transition-colors shadow-inner">
              <Coins className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-xl text-white mb-3">2. Collect Gold</h3>
            <p className="text-slate-400 leading-relaxed text-sm sm:text-base">Complete daily tasks and super tasks to stack up your balance fast.</p>
          </div>
          <div className="p-6 sm:p-8 bg-slate-900/60 backdrop-blur-sm rounded-3xl border border-slate-800 hover:border-yellow-200/30 transition-colors group">
            <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center mb-6 text-yellow-200 group-hover:text-white transition-colors shadow-inner">
              <Sparkles className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-xl text-white mb-3">3. Shine</h3>
            <p className="text-slate-400 leading-relaxed text-sm sm:text-base">Launch campaigns to boost your visibility and make your channel shine.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const Dashboard = ({ user, refreshUser }: { user: UserProfile, refreshUser: () => void }) => {
  const [myCampaigns, setMyCampaigns] = useState<(Task & { status: string })[]>([]);
  const [myCampaignStats, setMyCampaignStats] = useState<Record<string, {filled: number, total: number}>>({});
  const [activeCount, setActiveCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);

  useEffect(() => {
    // Real-time listener for campaigns
    if (user.uid.startsWith('mock-user')) return;

    // v8 syntax: db.collection().where()
    const q = db.collection("campaigns").where("userId", "==", user.uid);
    
    // v8 syntax: q.onSnapshot()
    const unsubscribe = q.onSnapshot((snapshot) => {
       const fetchedCampaigns: (Task & { status: string })[] = [];
       const stats: Record<string, {filled: number, total: number}> = {};
       let active = 0;
       let completed = 0;
       
       snapshot.docs.forEach((docSnap) => {
         const data = docSnap.data() as Campaign;
         
         // Robust completion check: Status is 'completed' OR filled >= requested
         const isFilled = (data.quantityFulfilled || 0) >= data.quantityRequested;
         const derivedStatus = (data.status === 'completed' || isFilled) ? 'completed' : data.status;

         fetchedCampaigns.push({
           id: docSnap.id,
           type: data.type,
           title: `My ${data.type} Campaign`,
           url: data.targetUrl,
           reward: 0,
           channelName: user.displayName || 'Me',
           thumbnailUrl: user.photoURL || '',
           creatorId: data.userId,
           status: derivedStatus
         });
         stats[docSnap.id] = { filled: data.quantityFulfilled || 0, total: data.quantityRequested };

         if (derivedStatus === 'active') active++;
         if (derivedStatus === 'completed') completed++;
       });
       
       // Sort: Active first, then by creation time (desc) if available, or title
       fetchedCampaigns.sort((a, b) => {
         if (a.status === b.status) return 0;
         return a.status === 'active' ? -1 : 1;
       });

       setMyCampaigns(fetchedCampaigns);
       setMyCampaignStats(stats);
       setActiveCount(active);
       setCompletedCount(completed);
    }, (err) => {
       console.warn("Error fetching dashboard data:", err);
    });

    return () => unsubscribe();
  }, [user.uid]);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-24">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg flex flex-col items-center text-center relative overflow-hidden group">
           <div className="absolute inset-0 bg-gradient-to-br from-brand-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
           <div className="w-12 h-12 bg-brand-500/20 text-brand-400 rounded-full flex items-center justify-center mb-3 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
             <Coins className="h-6 w-6"/>
           </div>
           <div className="text-3xl font-bold text-white mb-1">{user.points}</div>
           <div className="text-xs text-slate-400 uppercase font-bold tracking-wider">Gold Points</div>
        </div>
        
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg flex flex-col items-center text-center">
           <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mb-3">
             <Check className="h-6 w-6"/>
           </div>
           <div className="text-3xl font-bold text-white mb-1">{completedCount}</div>
           <div className="text-xs text-slate-400 uppercase font-bold tracking-wider">Campaigns Completed</div>
        </div>

        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg flex flex-col items-center text-center">
           <div className="w-12 h-12 bg-yellow-200/10 text-yellow-200 rounded-full flex items-center justify-center mb-3">
             <TrendingUp className="h-6 w-6"/>
           </div>
           <div className="text-3xl font-bold text-white mb-1">{activeCount}</div>
           <div className="text-xs text-slate-400 uppercase font-bold tracking-wider">Active Campaigns</div>
        </div>
      </div>

      {/* My Campaigns */}
      <section>
        <h2 className="text-xl font-bold text-white mb-4 px-1">My Campaigns</h2>
        {myCampaigns.length > 0 ? (
          <div className="space-y-4">
             {myCampaigns.map(task => (
               <TaskCard 
                 key={task.id} 
                 task={task} 
                 readOnly 
                 stats={myCampaignStats[task.id]} 
                 statusLabel={task.status}
               />
             ))}
          </div>
        ) : (
          <div className="bg-slate-800/50 rounded-2xl p-8 text-center border border-dashed border-slate-700 hover:border-brand-500/30 transition-colors">
            <p className="text-slate-400 mb-4">No campaigns found.</p>
            <Link to="/promote" className="inline-flex items-center text-brand-400 font-bold hover:text-brand-300 bg-slate-900/50 px-4 py-2 rounded-xl">
              Start Shining <ArrowRight className="h-4 w-4 ml-1.5"/>
            </Link>
          </div>
        )}
      </section>
    </div>
  );
};

// NEW: Earn Runner (MyToolsTown Style)
const EarnPage = ({ user, refreshUser }: { user: UserProfile, refreshUser: () => void }) => {
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [taskState, setTaskState] = useState<'ready' | 'pending_verification'>('ready');

  const loadNewTask = async () => {
    setLoading(true);
    setTaskState('ready');
    setCurrentTask(null);

    try {
      // Fetch active campaigns (v8)
      const q = db.collection("campaigns").where("status", "==", "active");
      const snapshot = await q.get();
      
      const availableDocs: any[] = [];
      
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Campaign;
        // Filter out own campaigns and fulfilled ones
        if (data.userId !== user.uid && (data.quantityFulfilled || 0) < data.quantityRequested) {
           availableDocs.push({ id: docSnap.id, ...data });
        }
      });

      if (availableDocs.length > 0) {
         // Select random
         const randomDoc = availableDocs[Math.floor(Math.random() * availableDocs.length)];
         
         // Fetch Creator Details (v8)
         const creatorSnap = await db.collection('users').doc(randomDoc.userId).get();
         let creatorName = 'Fellow Creator';
         let creatorPic = `https://ui-avatars.com/api/?name=${randomDoc.userId}&background=random`;

         if (creatorSnap.exists) {
             const creatorData = creatorSnap.data() as UserProfile;
             creatorName = creatorData.displayName || creatorName;
             creatorPic = creatorData.photoURL || creatorPic;
         }

         setCurrentTask({
             id: randomDoc.id,
             type: randomDoc.type,
             title: randomDoc.type === TaskType.SUBSCRIBE ? `Subscribe to ${creatorName}` : 
                    randomDoc.type === TaskType.LIKE ? 'Like this Video' : 'Watch Video',
             url: randomDoc.targetUrl,
             reward: randomDoc.costPerAction,
             channelName: creatorName,
             thumbnailUrl: creatorPic,
             creatorId: randomDoc.userId
         });

      } else {
         setCurrentTask(null);
      }
    } catch (err) {
      console.error("Failed to load tasks", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNewTask();
  }, []);

  const handleOpenTask = () => {
    if (!currentTask) return;
    window.open(currentTask.url, '_blank');
    setTaskState('pending_verification');
  };

  const handleVerify = async () => {
    if (!currentTask) return;
    setVerifying(true);
    
    // Simulate verification check
    try {
      const success = await verifyTaskCompletion(currentTask.id, currentTask.type);
      if (success) {
        // 1. Award Points to User (v8)
        const userRef = db.collection('users').doc(user.uid);
        await userRef.update({
          points: increment(currentTask.reward),
          tasksCompleted: increment(1),
          questCredits: increment(1) 
        });

        // 2. Update Campaign Stats (Decrement from pool effectively) (v8)
        const campaignRef = db.collection('campaigns').doc(currentTask.id);
        const campaignSnap = await campaignRef.get();
        
        if (campaignSnap.exists) {
            const campData = campaignSnap.data() as Campaign;
            const newFulfilled = (campData.quantityFulfilled || 0) + 1;
            const updates: any = { quantityFulfilled: newFulfilled };
            
            // Strictly check if we reached the requested quantity
            if (newFulfilled >= campData.quantityRequested) {
                updates.status = 'completed';
            }
            await campaignRef.update(updates);
        }

        refreshUser();
        // Auto load next
        loadNewTask();
      } else {
        alert("Verification failed. Please try again or skip.");
      }
    } catch (e) {
      console.error(e);
      alert("Error verifying task.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto pb-24 flex flex-col items-center justify-center min-h-[60vh]">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-2 flex items-center justify-center gap-2">
            Earn Points <Sparkles className="w-5 h-5 text-brand-400" />
        </h2>
        <p className="text-slate-400">Complete tasks to earn gold for your campaigns.</p>
        <div className="mt-2 text-xs font-bold text-brand-400 bg-brand-900/10 py-1 px-3 rounded-full inline-block border border-brand-500/20">
          +1 Quest Credit per Task
        </div>
      </div>

      {loading ? (
        <div className="bg-slate-800 p-12 rounded-3xl border border-slate-700 shadow-2xl flex flex-col items-center animate-pulse w-full">
          <Loader2 className="h-10 w-10 text-brand-500 animate-spin mb-4" />
          <div className="text-slate-400 font-medium">Finding next shining task...</div>
        </div>
      ) : currentTask ? (
        <div className="w-full bg-slate-800 rounded-3xl border border-slate-700 shadow-2xl overflow-hidden relative">
           {/* Header / Reward */}
           <div className="bg-gradient-to-r from-brand-400 to-amber-600 p-6 text-center shadow-lg relative overflow-hidden">
             <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20"></div>
             <div className="text-slate-900 font-bold uppercase tracking-widest text-xs mb-1 relative z-10">Reward</div>
             <div className="text-4xl font-extrabold text-white flex items-center justify-center gap-2 relative z-10 drop-shadow-md">
               +{currentTask.reward} <Coins className="h-8 w-8 text-yellow-100" />
             </div>
           </div>

           {/* Content */}
           <div className="p-8 text-center">
             <div className="relative inline-block mb-6">
                <img src={currentTask.thumbnailUrl} className="w-24 h-24 rounded-full border-4 border-slate-700 shadow-xl object-cover mx-auto" alt="Task" />
                <div className={`absolute bottom-0 right-0 p-2 rounded-full border-4 border-slate-800 ${
                  currentTask.type === 'LIKE' ? 'bg-red-500' :
                  currentTask.type === 'SUBSCRIBE' ? 'bg-slate-600' : 'bg-blue-500'
                }`}>
                  {currentTask.type === 'LIKE' ? <ThumbsUp className="h-4 w-4 text-white"/> : 
                   currentTask.type === 'SUBSCRIBE' ? <UserIcon className="h-4 w-4 text-white"/> : 
                   <PlayCircle className="h-4 w-4 text-white"/>}
                </div>
             </div>

             <h3 className="text-xl font-bold text-white mb-1">{currentTask.title}</h3>
             <p className="text-slate-500 text-sm mb-8">By {currentTask.channelName}</p>

             <div className="space-y-3">
                {taskState === 'ready' ? (
                  <button 
                    onClick={handleOpenTask}
                    className={`w-full py-4 px-6 rounded-xl font-bold text-lg shadow-lg shadow-brand-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] ${
                      currentTask.type === 'LIKE' ? 'bg-red-600 hover:bg-red-500 text-white' :
                      currentTask.type === 'SUBSCRIBE' ? 'bg-white hover:bg-slate-100 text-slate-900' :
                      'bg-blue-600 hover:bg-blue-500 text-white'
                    }`}
                  >
                    {currentTask.type === 'LIKE' ? 'Like Video' : 
                     currentTask.type === 'SUBSCRIBE' ? 'Subscribe Channel' : 'Watch Video'}
                  </button>
                ) : (
                   <button 
                    onClick={handleVerify}
                    disabled={verifying}
                    className="w-full py-4 px-6 rounded-xl font-bold text-lg bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20 transition-all animate-in zoom-in duration-200 flex items-center justify-center gap-2"
                   >
                     {verifying ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
                     {verifying ? 'Verifying...' : 'Confirm Action'}
                   </button>
                )}

                <button 
                  onClick={loadNewTask}
                  className="w-full py-3 px-6 rounded-xl font-semibold text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors flex items-center justify-center gap-2"
                >
                  Skip Task <SkipForward className="h-4 w-4" />
                </button>
             </div>
           </div>
        </div>
      ) : (
        <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-xl text-center max-w-md w-full">
           <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
             <Sparkles className="h-8 w-8" />
           </div>
           <h3 className="text-xl font-bold text-white mb-2">No Tasks Available</h3>
           <p className="text-slate-400 mb-6">There are currently no active campaigns from other users. Start your own campaign or check back later!</p>
           <button 
             onClick={loadNewTask}
             className="bg-brand-500 hover:bg-brand-400 text-slate-900 font-bold py-2.5 px-6 rounded-xl transition-colors flex items-center justify-center gap-2 mx-auto"
           >
             <RefreshCw className="h-4 w-4" /> Refresh
           </button>
        </div>
      )}
    </div>
  );
};

const PromotePage = ({ user, refreshUser }: { user: UserProfile, refreshUser: () => void }) => {
  const [url, setUrl] = useState('');
  const [type, setType] = useState<TaskType>(TaskType.LIKE);
  const [quantity, setQuantity] = useState(10);
  const [loading, setLoading] = useState(false);

  const getPrice = (t: TaskType) => {
    switch(t) {
      case TaskType.LIKE: return 1;
      case TaskType.SUBSCRIBE: return 2;
      case TaskType.WATCH: return 10;
      default: return 0;
    }
  };

  const cost = quantity * getPrice(type);

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user.points < cost) {
      alert("Insufficient points!");
      return;
    }

    setLoading(true);
    try {
      // v8: db.collection().doc().update()
      const userRef = db.collection('users').doc(user.uid);
      await userRef.update({
        points: increment(-cost)
      });

      // v8: db.collection().add()
      await db.collection('campaigns').add({
        userId: user.uid,
        type,
        targetUrl: url,
        quantityRequested: quantity,
        quantityFulfilled: 0,
        costPerAction: getPrice(type),
        status: 'active',
        createdAt: Date.now()
      });

      refreshUser();
      alert("Campaign created successfully!");
      setUrl('');
      setQuantity(10);
    } catch (err) {
      console.error(err);
      if (user.uid.startsWith('mock-user')) {
         alert("Campaign created (Simulation Only - Test Mode)");
         setUrl('');
      } else {
        alert("Error creating campaign.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto pb-24">
      <div className="bg-slate-800 shadow-2xl sm:rounded-2xl overflow-hidden border border-slate-700">
        <div className="px-6 py-6 sm:px-10 bg-slate-900/50 border-b border-slate-700">
          <h3 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            New Campaign <TrendingUp className="w-5 h-5 text-brand-400" />
          </h3>
          <p className="mt-1 text-sm sm:text-base text-slate-400">Spend gold points to make your channel shine.</p>
        </div>
        <div className="px-6 py-6 sm:p-10">
          <form onSubmit={handleCreateCampaign} className="space-y-6 sm:space-y-8">
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">YouTube URL</label>
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="block w-full rounded-xl bg-slate-900 border-slate-700 text-white shadow-sm focus:border-brand-500 focus:ring-brand-500 text-sm p-4 placeholder-slate-600 transition-all"
                placeholder="https://youtube.com/watch?v=..."
              />
            </div>

            <div className="grid grid-cols-1 gap-6 sm:gap-8 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">Action Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as TaskType)}
                  className="block w-full rounded-xl bg-slate-900 border-slate-700 text-white py-4 px-4 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-brand-500 text-sm transition-all"
                >
                  <option value={TaskType.LIKE}>Get Likes (1 Pt)</option>
                  <option value={TaskType.SUBSCRIBE}>Get Subscribers (2 Pts)</option>
                  <option value={TaskType.WATCH}>Get Views (10 Pts)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">Quantity</label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value))}
                  className="block w-full rounded-xl bg-slate-900 border-slate-700 text-white shadow-sm focus:border-brand-500 focus:ring-brand-500 text-sm p-4 transition-all"
                />
              </div>
            </div>

            <div className="bg-slate-900/80 p-5 rounded-xl flex justify-between items-center border border-slate-700/50">
              <span className="text-slate-300 font-medium text-sm">Total Cost</span>
              <span className="text-2xl font-bold text-brand-400">{cost} <span className="text-sm text-slate-500 font-normal">Pts</span></span>
            </div>

            <button
              type="submit"
              disabled={loading || user.points < cost}
              className={`w-full flex justify-center py-4 px-6 border border-transparent rounded-xl shadow-lg text-base font-bold text-slate-900 transition-all transform hover:-translate-y-0.5 ${user.points < cost ? 'bg-slate-700 cursor-not-allowed opacity-50 shadow-none hover:translate-y-0 text-white' : 'bg-gradient-to-r from-brand-300 to-brand-500 hover:from-brand-200 hover:to-brand-400 shadow-brand-500/20'}`}
            >
              {loading ? 'Processing...' : user.points < cost ? 'Insufficient Points' : 'Launch Campaign'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);

  useEffect(() => {
    // v8 syntax: auth.onAuthStateChanged
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        // Fetch user data
        // v8 syntax: db.collection('users').doc(uid).get()
        const userDocRef = db.collection('users').doc(firebaseUser.uid);
        const userSnap = await userDocRef.get();

        if (userSnap.exists) {
          setUser(userSnap.data() as UserProfile);
        } else {
          // If no doc exists yet (unlikely with new flow, but safe fallback)
          setUser({
             uid: firebaseUser.uid,
             displayName: firebaseUser.displayName || 'User',
             email: firebaseUser.email,
             photoURL: firebaseUser.photoURL,
             points: 10, // Start with 10 pts
             tasksCompleted: 0,
             questCredits: 0,
             role: 'user',
             superTasksCompletedToday: 0,
             lastSuperTaskDate: new Date().toISOString().split('T')[0],
             channelId: 'UC_PENDING'
          });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const refreshUser = async () => {
    if (!user) return;
    if (user.uid.startsWith('mock-user')) {
       return;
    }
    const userDocRef = db.collection('users').doc(user.uid);
    const userSnap = await userDocRef.get();
    if (userSnap.exists) {
      setUser(userSnap.data() as UserProfile);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 bg-gradient-to-br from-brand-300 to-brand-500 rounded-xl animate-pulse flex items-center justify-center text-slate-900 font-bold text-xl shadow-lg shadow-brand-500/30">K</div>
    </div>
  );

  return (
    <ErrorBoundary>
      <HashRouter>
        <div className="min-h-screen bg-slate-950 font-sans text-gray-100 selection:bg-brand-500 selection:text-white">
          <Navbar 
            user={user} 
            points={user?.points || 0} 
            onLoginClick={() => setShowLoginModal(true)}
          />
          
          {/* Desktop Sidebar Nav */}
          <SidebarNav user={user} points={user?.points || 0} onLoginClick={() => setShowLoginModal(true)} />
          
          {/* Mobile Bottom Nav */}
          <BottomNav user={user} onLoginClick={() => setShowLoginModal(true)} />

          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 relative lg:pl-24 transition-all duration-300">
            <Routes>
              <Route path="/" element={user ? <Dashboard user={user} refreshUser={refreshUser} /> : <LandingPage onLoginClick={() => setShowLoginModal(true)} />} />
              <Route path="/earn" element={user ? <EarnPage user={user} refreshUser={refreshUser} /> : <Navigate to="/" />} />
              <Route path="/promote" element={user ? <PromotePage user={user} refreshUser={refreshUser} /> : <Navigate to="/" />} />
            </Routes>
          </main>

          <LoginModal 
            isOpen={showLoginModal} 
            onClose={() => setShowLoginModal(false)}
            onLoginSuccess={(u) => setUser(u)}
          />
        </div>
      </HashRouter>
    </ErrorBoundary>
  );
}

export default App;