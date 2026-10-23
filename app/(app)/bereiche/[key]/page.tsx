import { WorkspaceDetail } from "@/components/workspaces/WorkspaceDetail";

export const metadata = { title: "Bereich · Life OS" };

export default async function BereichPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return <WorkspaceDetail wsKey={key} />;
}
