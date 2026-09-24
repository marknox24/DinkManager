import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { planEntryPath } from '../../utils/pendingPlan';

// Old /subscribe/:plan links (the former anonymous purchase form) now follow
// the sign-up-first flow: logged out -> /signup?plan=X (the plan is
// remembered through confirmation and login), logged in -> the dashboard's
// pricing pop-up with X pre-selected. Payment happens in that pop-up
// (PricingPromptModal), under the signed-in account.
export default function SubscribePage() {
  const { plan } = useParams();
  const { user, loading } = useAuth();
  if (loading) return null;
  return <Navigate to={planEntryPath(plan, Boolean(user))} replace />;
}
