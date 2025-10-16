import { Suspense } from 'react';
import Layout from './components/Layout.jsx';
import './App.css';
import useOnboardingJourney from './features/onboarding/useOnboardingJourney.js';

const PageFallback = () => (
  <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
    Carregando módulo...
  </div>
);

function App() {
  const { safeCurrentPage, onboarding, handleNavigate, renderPage } = useOnboardingJourney();

  return (
    <Layout currentPage={safeCurrentPage} onNavigate={handleNavigate} onboarding={onboarding}>
      <Suspense fallback={<PageFallback />}>{renderPage()}</Suspense>
    </Layout>
  );
}

export default App;
