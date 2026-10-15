import { useEffect, useState } from 'react';
import { Files as FilesIcon, Upload, Trash2, FileText, Image } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { formatDate, cn } from '@lib/utils';
import { EmptyState, PanelSkeleton } from '@components/ui/Primitives';
import api from '@lib/api';
import toast from 'react-hot-toast';

export default function Files() {
  usePageTitle('Files');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');

  useEffect(() => {
    api
      .get('/projects')
      .then((r) => {
        const list = r.data.data || [];
        setProjects(list);
        setProjectId((cur) => cur || list[0]?.id || '');
      })
      .catch(() => {});
  }, []);

  const fetchFiles = () => {
    api
      .get('/files')
      .then((r) => setFiles(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  // Three steps: ask the API for a signed slot, send the bytes straight to storage,
  // then confirm. (This used to post a multipart form the API never accepted, so
  // every upload failed.)
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!projectId) {
      toast.error('Choose a project first.');
      return;
    }
    setUploading(true);
    try {
      const { data } = await api.post('/files/upload', {
        filename: file.name,
        contentType: file.type || undefined,
        size: file.size,
        projectId,
      });
      const body = new FormData();
      body.append('cacheControl', '3600');
      body.append('', file);
      const put = await fetch(data.meta.upload.url, { method: 'PUT', body });
      if (!put.ok) throw new Error('storage upload failed');
      await api.post(`/files/${data.data.id}/confirm`);
      toast.success('File uploaded!');
      fetchFiles();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/files/${id}`);
      setFiles(files.filter((f) => f._id !== id));
      toast.success('File deleted.');
    } catch {
      toast.error('Delete failed.');
    }
  };

  if (loading) return <PanelSkeleton variant="cards" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-warm-900">Files</h2>
        <div className="flex items-center gap-2">
          {projects.length > 1 && (
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              aria-label="Project"
              className="input-fx text-sm max-w-[12rem]"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name || p.id}
                </option>
              ))}
            </select>
          )}
          <label
            className={cn(
              'btn-fox text-sm px-4 py-2 cursor-pointer',
              (uploading || !projectId) && 'opacity-50',
            )}
          >
            <Upload size={16} /> {uploading ? 'Uploading...' : 'Upload'}
            <input
              type="file"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading || !projectId}
            />
          </label>
        </div>
      </div>

      {files.length === 0 ? (
        <EmptyState
          icon={FilesIcon}
          title="No files yet"
          description="Upload project files, documents, or deliverables."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {files.map((f) => (
            <div
              key={f._id}
              className="bg-white rounded-xl border border-warm-200 p-4 flex items-start gap-3"
            >
              <div className="w-10 h-10 rounded-lg bg-warm-100 flex items-center justify-center shrink-0">
                {f.mimeType?.startsWith('image') ? (
                  <Image size={18} className="text-info-500" />
                ) : (
                  <FileText size={18} className="text-warm-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-warm-900 truncate">
                  {f.originalName || f.name}
                </p>
                <p className="text-xs text-warm-400 mt-0.5">{formatDate(f.createdAt)}</p>
              </div>
              <button
                onClick={() => handleDelete(f._id)}
                className="p-1.5 hover:bg-danger-50 rounded-lg text-warm-400 hover:text-danger-500 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
