"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ShieldCheck, Plus, Pencil, FilePlus, UploadCloud } from "lucide-react";
import { formatDate, daysUntil } from "@/lib/utils";
import { EthicsStatusBadge } from "./EthicsStatusBadge";
import { EthicsApplicationForm } from "./EthicsApplicationForm";
import { EthicsTimeline } from "./EthicsTimeline";
import { AmendmentCard } from "./AmendmentCard";
import { AmendmentForm } from "./AmendmentForm";
import { EthicsDocumentList } from "./EthicsDocumentList";
import { EthicsDocumentUpload } from "./EthicsDocumentUpload";
import { ExpiryWarning } from "./ExpiryWarning";
import type {
  EthicsApplication,
  EthicsAmendment,
  EthicsDocument,
} from "@/lib/types/database";

type Modal = "application" | "amendment" | "upload" | null;

export function EthicsPanel({
  projectId,
  initialApplication,
  initialAmendments,
  initialDocuments,
}: {
  projectId: string;
  initialApplication: EthicsApplication | null;
  initialAmendments: EthicsAmendment[];
  initialDocuments: EthicsDocument[];
}) {
  const supabase = createClient();

  const [application, setApplication] = useState<EthicsApplication | null>(
    initialApplication
  );
  const [amendments, setAmendments] = useState<EthicsAmendment[]>(initialAmendments);
  const [documents, setDocuments] = useState<EthicsDocument[]>(initialDocuments);
  const [modal, setModal] = useState<Modal>(null);

  // Check expiry and auto-update status if needed
  const isExpired =
    application?.status === "approved" &&
    application.expires_at &&
    daysUntil(application.expires_at) !== null &&
    (daysUntil(application.expires_at) as number) < 0;

  async function handleAutoExpire() {
    if (!application || !isExpired) return;
    const { data } = await supabase
      .from("ethics_applications")
      .update({ status: "expired" })
      .eq("id", application.id)
      .select()
      .single();
    if (data) setApplication(data);
  }

  // Trigger auto-expire check on mount side effect via rendering
  if (isExpired && application?.status !== "expired") {
    handleAutoExpire();
  }

  async function handleDownload(doc: EthicsDocument) {
    const { data } = await supabase.storage
      .from("ethics-documents")
      .createSignedUrl(doc.file_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Ethics & IRB Tracking</h2>
        {!application && (
          <button
            onClick={() => setModal("application")}
            className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New application
          </button>
        )}
      </div>

      {/* Expiry warning */}
      {application && (
        <ExpiryWarning expiresAt={application.expires_at} />
      )}

      {/* Empty state */}
      {!application ? (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-12 text-center">
          <ShieldCheck className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <h3 className="font-medium text-gray-700">No ethics application yet</h3>
          <p className="text-sm text-gray-400 mt-1 mb-4">
            Set up ethics tracking for this project
          </p>
          <button
            onClick={() => setModal("application")}
            className="inline-flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Create ethics application
          </button>
        </div>
      ) : (
        <>
          {/* Application card */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <EthicsStatusBadge status={application.status} />
                  {application.board_name && (
                    <span className="text-sm text-gray-600 font-medium">
                      {application.board_name}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 mt-3 text-sm">
                  {application.application_ref && (
                    <div>
                      <span className="text-gray-500">Ref: </span>
                      <span className="text-gray-900 font-medium">
                        {application.application_ref}
                      </span>
                    </div>
                  )}
                  {application.submitted_at && (
                    <div>
                      <span className="text-gray-500">Submitted: </span>
                      <span className="text-gray-900">
                        {formatDate(application.submitted_at)}
                      </span>
                    </div>
                  )}
                  {application.approved_at && (
                    <div>
                      <span className="text-gray-500">Approved: </span>
                      <span className="text-gray-900">
                        {formatDate(application.approved_at)}
                      </span>
                    </div>
                  )}
                  {application.expires_at && (
                    <div>
                      <span className="text-gray-500">Expires: </span>
                      <span className="text-gray-900">
                        {formatDate(application.expires_at)}
                      </span>
                    </div>
                  )}
                </div>

                {application.conditions && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                      Conditions
                    </p>
                    <p className="text-sm text-gray-700">{application.conditions}</p>
                  </div>
                )}

                {application.notes && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                      Notes
                    </p>
                    <p className="text-sm text-gray-700">{application.notes}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
              <button
                onClick={() => setModal("application")}
                className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-300 hover:bg-gray-50 transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
              <button
                onClick={() => setModal("amendment")}
                className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-300 hover:bg-gray-50 transition-colors"
              >
                <FilePlus className="h-3.5 w-3.5" />
                File amendment
              </button>
              <button
                onClick={() => setModal("upload")}
                className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-300 hover:bg-gray-50 transition-colors"
              >
                <UploadCloud className="h-3.5 w-3.5" />
                Upload document
              </button>
            </div>
          </div>

          {/* Amendments */}
          {amendments.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="font-medium text-gray-900 mb-3">
                Amendments ({amendments.length})
              </h3>
              <div className="space-y-2">
                {amendments.map((a, i) => (
                  <AmendmentCard key={a.id} amendment={a} index={i} />
                ))}
              </div>
            </div>
          )}

          {/* Documents */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-900">
                Documents ({documents.length})
              </h3>
              <button
                onClick={() => setModal("upload")}
                className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
              >
                <Plus className="h-3.5 w-3.5" />
                Upload
              </button>
            </div>
            <EthicsDocumentList documents={documents} onDownload={handleDownload} />
          </div>

          {/* Timeline */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="font-medium text-gray-900 mb-4">Timeline</h3>
            <EthicsTimeline application={application} amendments={amendments} />
          </div>
        </>
      )}

      {/* Modals */}
      {modal === "application" && (
        <EthicsApplicationForm
          projectId={projectId}
          existing={application}
          onSaved={(app) => {
            setApplication(app);
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}

      {modal === "amendment" && application && (
        <AmendmentForm
          applicationId={application.id}
          onCreated={(a) => {
            setAmendments((prev) => [...prev, a]);
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}

      {modal === "upload" && application && (
        <EthicsDocumentUpload
          applicationId={application.id}
          onUploaded={(doc) => {
            setDocuments((prev) => [...prev, doc]);
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
