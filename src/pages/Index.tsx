import { Navigate } from 'react-router-dom';

const Index = () => {
  // Redirect to dashboard for internal users
  // The /track route is for public order tracking
  return <Navigate to="/dashboard" replace />;
};

export default Index;
