"use client";

import { useRef, useState } from "react";
import { UploadCloud, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { EthicsDocument } from "@/lib/types/database";

const ALLOWED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export function EthicsDocumentUpload({
  applicationId,
  onUploaded,
  onClose,
}: {
  applicationId: string;
  onUploaded: (doc: EthicsDocument) => void;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFile(f: File) {
    if (!ALLOWED_TYPES.includes(f.type)) {
      setError("Only PDF, PNG, JPEG, and Word documents are allowed.");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError("File must be under 10 MB.");
      return;
    }
    setError(null);
    setFile(f);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  }

  async function upload() {
    if (!file) return;
    setUploading(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const path = `${applicationId}/${Date.now()}_${file.name}`;
    const { error: storageError } = await supabase.storage
      .from("ethics-documents")
      .upload(path, file);

    if (storageError) {
      setError(storageError.message);
      setUploading(false);
      return;
    }

    const { data, error: dbError } = await supabase
      .from("ethics_documents")
      .insert({
        application_id: applicationId,
        file_name: file.name,
        file_path: path,
        file_size: file.size,
        uploaded_by: user.id,
      })
      .select()
      .single();

    setUploading(false);
    if (dbError) {
      setError(dbError.message);
    } else if (data) {
      onUploaded(data);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Upload Document</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              dragging
                ? "border-blue-400 bg-blue-50"
                : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
            }`}
          >
            <UploadCloud className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            {file ? (
              <p className="text-sm font-medium text-gray-900">{file.name}</p>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-700">
                  Drop a file here or click to browse
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  PDF, PNG, JPEG, Word · Max 10 MB
                </p>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept={ALLOWED_TYPES.join(",")}
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={upload}
              disabled={!file || uploading}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "Upload"}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
