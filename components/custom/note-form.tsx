'use client';

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { post } from '@/lib/api';
import { CustomForm } from '@/components/custom/custom-form';
import { CustomInput } from '@/components/custom/custom-input';

const transactionSchema = z.object({
  note: z.string().optional()
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

export default function NoteForm({note, user_id, handleModalState}: {note: string, user_id: number, handleModalState: () => void}) {
  const [loading, setLoading] = useState(false);

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      note: note,
    },
  });

  const onSubmit = async (data: TransactionFormValues) => {
    const payload = {...data, user_id}
    try {
      setLoading(true);
    const url = '/api/admin/user-note'
      await post(url, payload)

      toast.success('Note submitted successfully!', { duration: 800 });
    } catch (error) {
      toast.error('Failed to submit note.');
    } finally {
      setLoading(false);
      handleModalState()
    }
  };

  return (
    <div className="w-full space-y-4">
      <CustomForm form={form} onSubmit={onSubmit} className="space-y-4">

        <CustomInput
          name="note"
          type="textarea"
          placeholder="Add note"
        />

        <Button
          type="submit"
          className="w-full bg-emerald-500 text-black hover:bg-emerald-400"
          disabled={loading}
        >
          {loading ? 'Saving..' : 'Save'}
        </Button>
      </CustomForm>
    </div>
  );
}
