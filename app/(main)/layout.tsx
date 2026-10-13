import AppHeader from "../components/AppHeader";
import Nudges from "../components/Nudges";
import ScheduleNotices from "../components/ScheduleNotices";
import {requireUser} from "../lib/dal";

// The header, nav and page column shared by Today, Calendar, Progress and Classes. The focus timer
// and clock live outside this group so they can take over the whole screen. On phones the nav is
// a bar at the bottom of the screen, so pages leave room for it there.
export default async function MainLayout({children}: LayoutProps<"/">) {
  await requireUser();
  return (
    <main className="sf-lift flex-1 font-mono text-white">
      <div className="mx-auto max-w-5xl px-4 pb-36 pt-6 sm:px-8 md:pb-24 sm:pt-8">
        <AppHeader />
        <ScheduleNotices />
        <Nudges />
        {children}
      </div>
    </main>
  );
}
