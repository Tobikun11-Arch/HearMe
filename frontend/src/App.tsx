import Index from '@/pages/Index';
import Learn from '@/pages/Learn';
import ErrorBoundary from '@/components/ErrorBoundary';
import {Navigate, Route, Routes} from 'react-router-dom';

function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/learn" element={<Learn />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
