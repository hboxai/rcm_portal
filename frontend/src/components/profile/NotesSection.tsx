import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Plus } from 'lucide-react';
import GlassCard from '../ui/GlassCard';
import Button from '../ui/Button';
import { VisitClaim } from '../../types/claim';
import { useClaims } from '../../contexts/ClaimContext';

interface NotesSectionProps {
  claim: VisitClaim;
}

const NotesSection: React.FC<NotesSectionProps> = ({ claim }) => {
  const { addNote } = useClaims();
  const [newNote, setNewNote] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);

  const handleAddNote = () => {
    if (newNote.trim() && claim.id) {
      addNote(claim.id.toString(), newNote.trim());
      setNewNote('');
      setIsAddingNote(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="mt-6"
    >
      <GlassCard>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <MessageSquare className="text-accent-400" size={20} />
            Notes
          </h2>
          
          {!isAddingNote && (
            <Button
              variant="secondary"
              onClick={() => setIsAddingNote(true)}
              icon={<Plus size={16} />}
            >
              Add Note
            </Button>
          )}
        </div>
        
        {isAddingNote && (
          <div className="mb-6">
            <textarea
              className="glass-input w-full h-24 resize-none"
              placeholder="Enter your note..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
            />
            
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setIsAddingNote(false);
                  setNewNote('');
                }}
              >
                Cancel
              </Button>
              
              <Button onClick={handleAddNote}>
                Add Note
              </Button>
            </div>
          </div>
        )}
        
        {claim.notes && claim.notes.length > 0 ? (
          <div className="space-y-4">
            {claim.notes.map((note, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index, duration: 0.3 }}
                className="bg-white/5 p-4 rounded-lg border border-white/10"
              >
                <p className="text-white/90">{note}</p>
                {index === 0 && claim.updatedAt && (
                  <p className="text-white/50 text-xs mt-2">
                    Added on {new Date(claim.updatedAt).toLocaleString()}
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-white/50">
            <p>No notes have been added yet.</p>
          </div>
        )}
      </GlassCard>
    </motion.div>
  );
};

export default NotesSection;
