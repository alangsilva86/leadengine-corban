import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from '@/components/ui/drawer.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';

const ContactQuickEditDrawer = ({ open, onOpenChange, contact, onSubmit }) => {
  const {
    register,
    control,
    reset,
    handleSubmit,
    formState: { isDirty, isSubmitting },
  } = useForm({
    defaultValues: {
      name: contact?.name ?? '',
      phone: contact?.phone ?? '',
      email: contact?.email ?? '',
      document: contact?.document ?? '',
      notes: contact?.notes ?? '',
      isBlocked: Boolean(contact?.isBlocked),
    },
  });

  useEffect(() => {
    reset({
      name: contact?.name ?? '',
      phone: contact?.phone ?? '',
      email: contact?.email ?? '',
      document: contact?.document ?? '',
      notes: contact?.notes ?? '',
      isBlocked: Boolean(contact?.isBlocked),
    });
  }, [contact, reset]);

  const handleFormSubmit = handleSubmit((values) => {
    onSubmit?.({ ...values });
  });

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="sm:max-w-lg">
        <DrawerHeader>
          <DrawerTitle>Editar contato</DrawerTitle>
          <DrawerDescription>Atualize os dados principais do contato em tempo real.</DrawerDescription>
        </DrawerHeader>
        <form className="flex flex-1 flex-col gap-4 p-4" onSubmit={handleFormSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="contact-name">
              Nome
            </label>
            <Input id="contact-name" placeholder="Nome completo" {...register('name')} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="contact-phone">
              Telefone
            </label>
            <Input id="contact-phone" placeholder="(11) 99999-0000" {...register('phone')} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="contact-email">
              E-mail
            </label>
            <Input id="contact-email" type="email" placeholder="email@cliente.com" {...register('email')} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="contact-document">
              Documento
            </label>
            <Input id="contact-document" placeholder="CPF/CNPJ" {...register('document')} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="contact-notes">
              Notas
            </label>
            <Textarea id="contact-notes" rows={4} placeholder="Observações internas" {...register('notes')} />
          </div>
          <Controller
            name="isBlocked"
            control={control}
            render={({ field }) => (
              <label className="flex items-center gap-2 text-sm font-medium">
                <Checkbox
                  checked={Boolean(field.value)}
                  onCheckedChange={(nextValue) => field.onChange(Boolean(nextValue))}
                />
                Bloquear contato para campanhas
              </label>
            )}
          />
          <DrawerFooter>
            <DrawerClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DrawerClose>
            <Button type="submit" disabled={!isDirty || isSubmitting}>
              {isSubmitting ? 'Salvando…' : 'Salvar alterações'}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
};

export default ContactQuickEditDrawer;
