import { getDashboard } from "../../lib/dashboard";

export default function DashboardPage() {
  const dashboard = getDashboard();
  return <main><h1>{dashboard.title}</h1><p>{dashboard.message}</p></main>;
}
