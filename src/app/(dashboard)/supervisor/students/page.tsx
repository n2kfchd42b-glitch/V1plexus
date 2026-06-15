import { redirect } from "next/navigation";

// The supervisor student roster lives on the dashboard; /supervisor/students has
// no list of its own (only /supervisor/students/[studentId] detail pages).
// Redirect the bare path so it resolves instead of 404ing on direct navigation.
export default function SupervisorStudentsIndex() {
  redirect("/supervisor/dashboard");
}
