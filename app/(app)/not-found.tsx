import Link from "next/link";

export default function NotFound() {
  return (
    <div className="px-8 py-12">
      <div className="label mb-2">Not found</div>
      <p className="mb-3 text-[14px]">That page is not part of this prototype.</p>
      <Link href="/signals" className="text-[13px] underline">
        Back to Signals
      </Link>
    </div>
  );
}
