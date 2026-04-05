# Document Editor Pillars — Integration Guide

## Three Pillars Implemented
1. **Pillar 1:** Real-time Collaboration + Version Control (diff view)
2. **Pillar 2:** Scientific Writing (Structured Abstract Builder)
3. **Pillar 5:** Authorship Transparency (CRediT taxonomy)

---

## File Structure

### Database
```
supabase/migrations/
  20260405100000_document_editor_pillars_1_2_5.sql  ← Run this first
```

**Tables Created:**
- `document_presence` — Live cursor tracking
- `document_citations` — Links citations to documents
- `document_author_roles` — Author management with CRediT roles

**Tables Enhanced:**
- `document_versions` — Added: `content_hash`, `is_auto_save`, `label`

---

### Frontend Components

#### Pillar 1: Version Control
```
src/components/document/
  VersionHistoryEnhanced.tsx  ← Replace old VersionHistory (has diff view)
  SaveVersionButton.tsx       ← Already exists, still works
```

#### Pillar 2: Structured Abstract
```
src/components/document/
  StructuredAbstractModal.tsx ← New modal, standalone
```

#### Pillar 5: Authorship
```
src/components/document/
  AuthorshipPanel.tsx         ← Right sidebar panel
  AuthorshipStatement.tsx      ← Auto-formatted CRediT statement
```

#### Utilities
```
src/lib/
  credit-taxonomy.ts          ← CRediT role definitions
  diff-utils.ts               ← Diff algorithm (LCS-based)

src/types/
  document-editor-pillars.ts  ← TypeScript types
```

---

### API Routes

#### Authorship (Pillar 5)
```
src/app/api/documents/[documentId]/authors/
  route.ts                    ← GET/POST authors
  [authorId]/
    route.ts                  ← PUT/DELETE single author
    confirm/route.ts          ← POST confirm authorship
```

#### Versions (Pillar 1)
```
src/app/api/documents/[documentId]/versions/
  route.ts                    ← GET/POST versions
  [versionId]/
    restore/route.ts          ← POST restore to version
```

---

### Integration Hook
```
src/hooks/
  useDocumentEditorPillars.ts ← Provides:
    - useDocumentAuthors()
    - useDocumentVersions()
```

---

## How to Integrate into Editor Page

Edit: `src/app/(dashboard)/projects/[id]/documents/[docId]/page.tsx`

### Step 1: Import Components & Hooks

```typescript
import { VersionHistoryEnhanced } from '@/components/document/VersionHistoryEnhanced'
import { AuthorshipPanel } from '@/components/document/AuthorshipPanel'
import { StructuredAbstractModal } from '@/components/document/StructuredAbstractModal'
import { 
  useDocumentAuthors, 
  useDocumentVersions 
} from '@/hooks/useDocumentEditorPillars'
import type { DocumentVersion } from '@/types/document-editor-pillars'
```

### Step 2: Add State & Hooks

```typescript
export default function DocumentPage() {
  // ... existing state ...
  
  // Pillar 1: Versions
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const { versions, fetchVersions, saveVersion, restoreVersion } = 
    useDocumentVersions(docId)
  
  // Pillar 5: Authors
  const [showAuthorship, setShowAuthorship] = useState(false)
  const { authors, fetchAuthors, addAuthor, updateAuthor, deleteAuthor } = 
    useDocumentAuthors(docId)
  
  // Pillar 2: Abstract
  const [showAbstractModal, setShowAbstractModal] = useState(false)
  
  // Fetch data on mount
  useEffect(() => {
    fetchVersions()
    fetchAuthors()
  }, [docId, fetchVersions, fetchAuthors])
```

### Step 3: Add Toolbar Buttons

In the editor toolbar, add:

```typescript
<Button
  size="sm"
  variant="outline"
  onClick={() => setShowVersionHistory(!showVersionHistory)}
  title="Show version history"
>
  <History className="h-4 w-4" />
</Button>

<Button
  size="sm"
  variant="outline"
  onClick={() => setShowAbstractModal(true)}
  title="Insert structured abstract"
>
  <FileText className="h-4 w-4" />
  Abstract
</Button>

<Button
  size="sm"
  variant="outline"
  onClick={() => setShowAuthorship(!showAuthorship)}
  title="Manage authorship"
>
  <Users className="h-4 w-4" />
  Authors
</Button>
```

### Step 4: Render Panels

```typescript
{/* Version History Panel */}
{showVersionHistory && (
  <VersionHistoryEnhanced
    versions={versions}
    currentVersion={document?.current_version || 1}
    currentContent={document?.content || null}
    onClose={() => setShowVersionHistory(false)}
    onRestore={async (version) => {
      const v = await restoreVersion(version.id)
      if (v) {
        const updated = await supabase
          .from('documents')
          .select('*')
          .eq('id', docId)
          .single()
        if (updated.data) setDocument(updated.data)
      }
    }}
  />
)}

{/* Authorship Panel */}
{showAuthorship && (
  <AuthorshipPanel
    documentId={docId}
    authors={authors}
    onAuthorsChange={(newAuthors) => {
      // Batch update or sync with API
      Promise.all(
        newAuthors.map((a) => 
          updateAuthor(a.id, a).catch(() => null)
        )
      )
    }}
    onSave={async () => {
      await fetchAuthors()
    }}
  />
)}

{/* Structured Abstract Modal */}
<StructuredAbstractModal
  isOpen={showAbstractModal}
  onClose={() => setShowAbstractModal(false)}
  onInsert={(abstractText) => {
    // Insert into editor (depends on your editor implementation)
    editor?.chain().focus().insertContent(abstractText).run()
  }}
/>
```

---

## Database Migration

Run this SQL in Supabase:

```bash
# From project root:
supabase db push  # or manually run the migration file
```

The migration file is:
`supabase/migrations/20260405100000_document_editor_pillars_1_2_5.sql`

---

## Key Features

### Pillar 1: Version History with Diff View
- ✅ List all saved versions
- ✅ Paragraph-level diff (green/red highlighting)
- ✅ Word count tracking
- ✅ Change summaries
- ✅ One-click restore (creates new version)
- ✅ Auto-saves hidden by default

### Pillar 2: Structured Abstract Builder
- ✅ 4 journal templates (Default, IMRAD, NEJM, PLOS)
- ✅ Word limits per section
- ✅ Real-time word count
- ✅ Drag-to-add sections
- ✅ Formatted output for journal submission

### Pillar 5: Authorship Transparency
- ✅ Drag-to-reorder authors
- ✅ CRediT role selection (14 roles)
- ✅ ORCID integration
- ✅ Author confirmation status
- ✅ Auto-generated CRediT statement
- ✅ Corresponding author flag

---

## Environment Variables

Ensure these are set in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

---

## Testing Checklist

- [ ] Database migration runs successfully
- [ ] AuthorshipPanel renders without errors
- [ ] Can add/edit/delete authors
- [ ] CRediT statement updates automatically
- [ ] VersionHistoryEnhanced shows diff view
- [ ] Version restore creates new entry
- [ ] StructuredAbstractModal opens/closes
- [ ] Abstract content inserts into editor

---

## Next Steps (Future Pillars)

- **Pillar 3:** Data Integration & Reproducibility
  - Analysis embed blocks
  - Live data refresh
  - Reproducibility footnotes

- **Pillar 4:** Security + Ethics
  - Document access controls
  - Ethics gates for export
  - Audit trail viewer

- **Pillar 6:** Multilingual
  - Language selector
  - AI translation panel
  - RTL support

---

## API Documentation

### Authorship Endpoints

```
GET    /api/documents/{id}/authors
POST   /api/documents/{id}/authors
PUT    /api/documents/{id}/authors/{authorId}
DELETE /api/documents/{id}/authors/{authorId}
POST   /api/documents/{id}/authors/{authorId}/confirm
```

### Version Endpoints

```
GET    /api/documents/{id}/versions
POST   /api/documents/{id}/versions
POST   /api/documents/{id}/versions/{versionId}/restore
```

---

## Support

For issues or questions, refer to:
- Component documentation in JSDoc comments
- Type definitions in `src/types/document-editor-pillars.ts`
- API routes for implementation details
