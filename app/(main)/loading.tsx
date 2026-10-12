// Shown the moment a section is tapped, while the page itself comes from the server: the header
// and tab bar stay, and empty glass takes the page's place. Prefetched with the links, so it
// appears instantly, but it waits a beat before showing, so a page that arrives quickly never
// flashes it (.sf-skeleton in globals.css).
export default function Loading() {
  return (
    <div className="sf-skeleton mt-6 grid gap-4 sm:mt-8 sm:grid-cols-2" role="status" aria-label="Loading">
      <div className="sf-card h-56 sm:col-span-2" />
      <div className="sf-card h-40" />
      <div className="sf-card h-40" />
    </div>
  );
}
