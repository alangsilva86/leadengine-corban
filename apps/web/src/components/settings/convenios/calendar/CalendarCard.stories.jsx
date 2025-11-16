import { useState } from 'react';
import CalendarCard from './CalendarCard.jsx';
import WindowDialog from './WindowDialog.jsx';

const sampleWindows = [
  {
    id: '1',
    label: 'Jan/24',
    start: new Date('2024-01-01'),
    end: new Date('2024-01-31'),
    firstDueDate: new Date('2024-03-01'),
  },
  {
    id: '2',
    label: 'Mar/24',
    start: new Date('2024-03-01'),
    end: new Date('2024-03-31'),
    firstDueDate: new Date('2024-05-01'),
  },
];

const meta = {
  title: 'Settings/Convenios/Calendar',
};

export default meta;

export const Calendar = {
  render: () => {
    const [windows, setWindows] = useState(sampleWindows);
    return (
      <CalendarCard
        windows={windows}
        onUpsert={(payload) => setWindows((current) => current.some((w) => w.id === payload.id) ? current.map((w) => (w.id === payload.id ? payload : w)) : [...current, payload])}
        onRemove={(id) => setWindows((current) => current.filter((window) => window.id !== id))}
        readOnly={false}
      />
    );
  },
};

export const WindowForm = {
  render: () => (
    <WindowDialog open onClose={() => {}} onSubmit={() => {}} initialValue={sampleWindows[0]} windows={sampleWindows} disabled={false} />
  ),
};
