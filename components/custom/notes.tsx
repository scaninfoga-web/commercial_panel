'use client'

import { MapPin, NotebookIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { Modal } from './modal';
import NoteForm from './note-form';
import { get } from '@/lib/api';
import { toast } from 'sonner';
import { Loader } from './custom-loader';

interface PropsUtil {
  user_id: number;
}
export const Notes: React.FC<PropsUtil> = ({user_id}) => {

const [note, setNote] = useState("")
const [loading, setLoading] = useState(false)

const [modalOpen, setModalOpen] = useState(false)

const populateData = async () => {
    try{
      setLoading(true)
        const data = await get(`/api/admin/user-note?user_id=${user_id}`)
        setNote(data.responseData.note || "")
    }
    catch(error){
        toast.error("Failed to load the user note")
        console.error("Fetch note failed: ", error)
    }
    finally{
      setLoading(false)
    }
}

useEffect(() => {
    populateData();
}, [])

const handleModalState = () => {
  setModalOpen(false);
  populateData();
}

 if(loading){
    return (
      <Card>
    <Loader />
      </Card>
    )
  }

  return (
    <>
    <Card className="card-bg border-slate-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-emerald-500">
          <NotebookIcon className="h-5 w-5 text-emerald-500" />
          Notes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {
            note && (
                <div className="border p-2 mb-2">
                    {
                        note.substring(0, 50) + "..."
                    }
                </div>
            )
        }
        <div className="flex justify-center">
        <Button onClick={() => setModalOpen(true)}> Add / View Note </Button>
        </div>
      </CardContent>
    </Card>

    <Modal
      open={modalOpen}
      onClose={() => setModalOpen(false)}
      title="Note"
      showFooter={false}
    >
      <NoteForm handleModalState={handleModalState} note={note} user_id={user_id} />
    </Modal>
    </>
  );
};
