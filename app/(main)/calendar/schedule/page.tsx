import {Card, CardHead} from "../../../components/Card";
import CalendarViews from "../../../components/CalendarViews";
import SessionForm from "../../../components/SessionForm";
import SessionList from "../../../components/SessionList";
import TodayReminders from "../../../components/TodayReminders";

// Today's sessions as a list: add one with the form, tick them off, or remove them. Today's
// reminders follow, when there are any.
export default function SchedulePage() {
  return (
    <div className="mx-auto mt-6 max-w-3xl sm:mt-10">
      <CalendarViews />

      <Card className="mt-4 sm:p-7">
        <CardHead label="Add to today" />
        <div className="mt-5">
          <SessionForm />
        </div>
      </Card>

      <Card className="mt-4 sm:p-7">
        <CardHead label="Today's schedule" />
        <div className="mt-3">
          <SessionList removable empty="Your schedule is empty. Add your first session above." />
        </div>
      </Card>

      <TodayReminders />
    </div>
  );
}
