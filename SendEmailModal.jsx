import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import SendEmail from './SendEmail';

export default function SendEmailModal() {
  const navigate = useNavigate();
  const location = useLocation();

  // Using navigate(-1) ensures we go back to the previous page context safely
  const handleClose = () => {
    navigate(-1);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop with blur effect to match the CFOO Budget theme */}
      <div 
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity" 
        onClick={handleClose}
      />

      {/* Modal Content container */}
      <div className="relative w-full max-w-2xl transform overflow-hidden rounded-3xl bg-[#0f172a] border border-white/10 shadow-2xl transition-all max-h-[90vh] flex flex-col">
        <div className="p-6 overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <i className="fas fa-paper-plane text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">Email System</h3>
            </div>
            <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-all">
              <i className="fas fa-times" />
            </button>
          </div>

          {/* 
            Spread location.state to ensure SendEmail receives the data it 
            needs (like sbar record or beneficiary info) which was passed during navigation.
          */}
          <SendEmail onClose={handleClose} isModal={true} {...(location.state || {})} />
        </div>
      </div>
    </div>
  );
}