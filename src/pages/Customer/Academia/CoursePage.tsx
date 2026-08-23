// Rota fullscreen /academia/curso/:courseId — visão do curso (player + aulas).

import { useNavigate } from 'react-router-dom';
import AcademiaShell from './AcademiaShell';
import CourseView from './CourseView';

export default function CourseViewPage() {
  const navigate = useNavigate();
  return (
    <AcademiaShell>
      <CourseView onBack={() => navigate('/academia')} />
    </AcademiaShell>
  );
}
