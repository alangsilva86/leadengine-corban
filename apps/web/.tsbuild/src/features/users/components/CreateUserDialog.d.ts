import type { CreateUserInput } from '../types';
type CreateUserDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (payload: CreateUserInput) => void;
    submitting?: boolean;
};
declare const CreateUserDialog: ({ open, onOpenChange, onSubmit, submitting }: CreateUserDialogProps) => import("react/jsx-runtime").JSX.Element;
export default CreateUserDialog;
