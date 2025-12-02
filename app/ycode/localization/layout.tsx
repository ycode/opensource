/**
 * Localization Layout
 *
 * This layout is used by Next.js for localization routes, but the actual
 * rendering is handled by YCodeBuilder which provides the HeaderBar
 * and LocalizationContent component. This layout just passes through children.
 */
export default function LocalizationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // YCodeBuilder handles all rendering including HeaderBar and LocalizationContent
  // This layout just passes through children
  return <>{children}</>;
}
