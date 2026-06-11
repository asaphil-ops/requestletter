import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import Swal from 'sweetalert2';

export default function SendEmail({ onClose, isModal, to, subject, body, draft }) {
  // Extract values from direct props or from the 'draft' object passed via state
  const initialTo = to || draft?.to || '';
  const initialSubject = subject || draft?.subject || '';
  const initialBody = body || draft?.note || draft?.body || '';

  const [formData, setFormData] = useState({
    // Ensure 'to' is a string even if an array was passed
    to: Array.isArray(initialTo) ? initialTo.join(', ') : initialTo,
    subject: initialSubject,
    body: initialBody,
  });

  // mutation logic using TanStack Query as seen in project context
  const sendMutation = useMutation({
    mutationFn: async (data) => {
      // Simulate API call to send email - Replace with your actual API endpoint
      return new Promise((resolve) => setTimeout(resolve, 1500));
    },
    onSuccess: () => {
      Swal.fire({
        title: 'Success!',
        text: 'Email has been sent successfully.',
        icon: 'success',
        confirmButtonColor: '#2563eb'
      });
      // Safe check for onClose prop to prevent "white screen" crashes
      if (onClose) onClose();
    },
    onError: () => {
      Swal.fire({
        title: 'Error',
        text: 'Failed to send email. Please check your connection.',
        icon: 'error'
      });
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.to || !formData.subject) {
      Swal.fire('Error', 'Please fill in required fields', 'error');
      return;
    }
    sendMutation.mutate(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-white">
      <div className="space-y-1">
        <label className="text-xs font-medium text-white/60 uppercase tracking-wider">Recipient Email</label>
        <input
          type="email"
          value={formData.to}
          onChange={(e) => setFormData({ ...formData, to: e.target.value })}
          placeholder="recipient@example.com"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm"
          required
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-white/60 uppercase tracking-wider">Subject</label>
        <input
          type="text"
          value={formData.subject}
          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
          placeholder="Enter subject"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm"
          required
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-white/60 uppercase tracking-wider">Message Body</label>
        <textarea
          value={formData.body}
          onChange={(e) => setFormData({ ...formData, body: e.target.value })}
          rows={5}
          placeholder="Type your message here..."
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm resize-none"
        />
      </div>

      <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/5">
        {isModal && (
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-all"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={sendMutation.isPending}
          className={`px-8 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-blue-500/20 flex items-center gap-2 transition-all
            ${sendMutation.isPending 
              ? 'bg-blue-600/50 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-500 active:scale-95'}`}
        >
          {sendMutation.isPending ? (
            <>
              <i className="fas fa-circle-notch animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <i className="fas fa-paper-plane" />
              Send Email
            </>
          )}
        </button>
      </div>
    </form>
  );
}