'use client';

export function DownloadPdfButton({ invoiceId }: { invoiceId: string }) {
  return (
    <button
      data-print="hide"
      onClick={() => {
        document.title = `Invoice ${invoiceId}`;
        window.print();
      }}
      className="rounded border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
    >
      Download PDF
    </button>
  );
}
