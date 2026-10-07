import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SupplierProfile } from "@/components/scorecard/supplier-profile";
import { getSupplier, listSuppliers } from "@/lib/api";
import { supplierPageData } from "@/lib/scorecard-data";

export function generateStaticParams() {
  return listSuppliers().map((s) => ({ id: s.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: getSupplier(id)?.name ?? id };
}

export default async function SupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = supplierPageData(id);
  if (!data) notFound();
  return <SupplierProfile data={data} />;
}
