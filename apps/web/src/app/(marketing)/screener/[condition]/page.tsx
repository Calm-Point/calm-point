import { notFound, redirect } from "next/navigation";
import { CONDITIONS } from "@calm-point/shared";
import { ScreenerFlow } from "./screener-flow";

export function generateStaticParams() {
  return CONDITIONS.filter((c) => c.screener).map((c) => ({ condition: c.slug }));
}

export const dynamicParams = false;

export default async function ScreenerPage({
  params,
}: {
  params: Promise<{ condition: string }>;
}) {
  const { condition } = await params;
  const config = CONDITIONS.find((c) => c.slug === condition);
  if (!config) notFound();
  if (!config.screener) redirect("/signup");

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col px-4 py-8">
      <ScreenerFlow conditionSlug={config.slug} conditionLabel={config.label} />
    </main>
  );
}
