import { useParams, useNavigate } from 'react-router-dom';

export function ReaderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center"
      style={{ background: '#1c1814', color: '#d4c9b0' }}
    >
      <p className="text-sm opacity-60">Loading reader for book {id}…</p>
      <button
        onClick={() => navigate(-1)}
        className="mt-4 text-xs opacity-40 hover:opacity-70 transition-opacity"
      >
        ← Go back
      </button>
    </div>
  );
}
