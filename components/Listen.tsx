'use client';

// Reads a screen's help text aloud in Telugu or English with the phone's built-in voice (R-4.3 interim;
// pre-recorded Telugu audio can replace this per screen).
export default function Listen({ text, lang, label }: { text: string; lang: 'en' | 'te'; label: string }) {
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm listen"
      onClick={() => {
        if (!('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang === 'te' ? 'te-IN' : 'en-IN';
        u.rate = 0.9;
        window.speechSynthesis.speak(u);
      }}
    >
      <span aria-hidden="true">🔊</span> {label}
    </button>
  );
}
