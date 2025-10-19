import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';

const InteractionComposer = ({ onSubmit, isSubmitting = false }) => {
  const [message, setMessage] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!message.trim()) {
      return;
    }
    onSubmit?.({ message: message.trim() });
    setMessage('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registrar interação</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <Textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={4}
            placeholder="Resuma a interação realizada com o contato"
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting || !message.trim()}>
              {isSubmitting ? 'Registrando…' : 'Adicionar à timeline'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default InteractionComposer;
