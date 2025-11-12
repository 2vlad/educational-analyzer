# Manual Programs Upload Fix

**Date:** 2025-11-12  
**Status:** ✅ Fixed  
**Priority:** High

## Problem Description

When trying to load lessons for a `manual` type program, the system showed an error:

```
No adapter found for source type: manual
```

### Root Cause

The "Загрузить уроки" (Load Lessons) button was using the `enumerate` endpoint, which:

1. Requires an adapter to scrape lessons from external sources (Yonote, Generic List)
2. Has no adapter for `manual` type programs (since they need file uploads, not scraping)

The UI wasn't distinguishing between program types and showed the same "enumerate" button for all programs.

## Solution

### 1. Updated Program Type (`types/programs.ts`)

Added `sourceType` field to the Program interface:

```typescript
export interface Program {
  id: string
  title: string
  lessonsCount: number
  completedCount: number
  status: 'draft' | 'active' | 'completed'
  sourceType: 'yonote' | 'generic_list' | 'manual' // ← Added
}
```

### 2. Updated ProgramsList Component

Modified `components/programs/ProgramsList.tsx` to show different buttons based on program type:

**For manual programs:**

- Show "Загрузить файлы" (Upload Files) button
- Opens UploadLessonsButton modal for file upload

**For yonote/generic_list programs:**

- Show "Загрузить уроки" (Load Lessons) button
- Calls enumerate endpoint to scrape lessons

```tsx
{
  program.sourceType === 'manual' && onUploadSuccess && (
    <UploadLessonsButton
      programId={program.id}
      programName={program.title}
      onSuccess={onUploadSuccess}
    />
  )
}

{
  ;(program.sourceType === 'yonote' || program.sourceType === 'generic_list') &&
    onEnumerateLessons && (
      <Button onClick={() => onEnumerateLessons(program.id)}>Загрузить уроки</Button>
    )
}
```

### 3. Updated Programs Page

Modified `app/programs/page.tsx` to:

- Pass `sourceType` from API data to UI components
- Add `onUploadSuccess` handler to reload programs and lessons after upload

### 4. Updated UploadLessonsButton Styling

Made the button consistent with other action buttons:

- Size: `sm`
- Variant: `outline`
- Icon size: `w-3 h-3`
- Text size: `text-xs`

## Files Changed

```
Modified:
- types/programs.ts
- components/programs/ProgramsList.tsx
- components/programs/UploadLessonsButton.tsx
- app/programs/page.tsx

Created:
- docs/MANUAL_PROGRAMS_FIX_2025_11_12.md
```

## Testing

### Manual Testing Steps

1. **Create a manual program:**

   ```
   - Go to /programs
   - Click "Добавить новую программу"
   - Select "Ручная загрузка" (Manual)
   - Give it a name
   - Create
   ```

2. **Verify correct button appears:**

   ```
   - Select the manual program
   - Should see "Загрузить файлы" button
   - Should NOT see "Загрузить уроки" button
   ```

3. **Test file upload:**

   ```
   - Click "Загрузить файлы"
   - Drag and drop .txt files or click to select
   - Click "Загрузить"
   - Verify lessons appear in the list
   - Verify lesson count updates
   ```

4. **Test yonote/generic_list programs:**
   ```
   - Create a yonote or generic_list program
   - Should see "Загрузить уроки" button
   - Should NOT see "Загрузить файлы" button
   ```

### Expected Behavior

| Program Type | Button Text     | Action                   |
| ------------ | --------------- | ------------------------ |
| manual       | Загрузить файлы | Opens file upload modal  |
| yonote       | Загрузить уроки | Calls enumerate endpoint |
| generic_list | Загрузить уроки | Calls enumerate endpoint |

## API Endpoints Affected

### No Changes to API

The API already supported both methods:

- `POST /api/programs/[id]/enumerate` - For scraping (yonote, generic_list)
- `POST /api/programs/[id]/upload-lessons` - For manual upload (manual)

This was purely a UI fix to call the correct endpoint based on program type.

## Related Features

### File Upload Modal (`UploadLessonsButton`)

Features:

- Drag and drop file upload
- Multiple file support (up to 100 files)
- File type validation (.txt, .md, .html, .pdf)
- Size limit: 10MB per file
- Progress indication
- Error handling

### Supported File Types

- `.txt` - Plain text
- `.md` - Markdown
- `.html` - HTML content
- `.pdf` - PDF documents (extracted to text)

## Future Improvements

1. **Batch File Upload Progress**
   - Show upload progress per file
   - Allow canceling individual files
   - Better error messages per file

2. **File Preview**
   - Preview file content before upload
   - Edit content inline
   - Validate content structure

3. **Template Support**
   - Provide lesson file templates
   - Suggest naming conventions
   - Auto-detect lesson metadata

4. **Bulk Import**
   - Import from Google Drive
   - Import from Dropbox
   - Import from URL list

## Migration Notes

### For Existing Users

No migration needed! This is a UI-only fix:

- Existing manual programs will now show the correct button
- Existing lessons remain unchanged
- Upload functionality was already working

### For Developers

If you're working on program-related features:

1. Always check `sourceType` before showing UI actions
2. Use appropriate endpoint based on program type:
   - `manual` → `/upload-lessons`
   - `yonote` or `generic_list` → `/enumerate`
3. Pass `sourceType` through component props chain

## Rollback Plan

If issues occur:

1. **Revert UI changes:**

   ```bash
   git revert <commit-hash>
   ```

2. **Temporary workaround:**
   Show both buttons for all program types (not recommended)

3. **Alternative:**
   Disable manual program creation temporarily

## Success Criteria

- [x] Manual programs show "Загрузить файлы" button
- [x] Yonote programs show "Загрузить уроки" button
- [x] Generic list programs show "Загрузить уроки" button
- [x] File upload works for manual programs
- [x] Enumerate works for yonote/generic_list programs
- [x] No "adapter not found" errors

## Related Documentation

- [BATCH_UPLOAD_UI.md](../BATCH_UPLOAD_UI.md) - Batch upload UI design
- [PROGRAMS_AUTH_FIX_2025_11_12.md](./PROGRAMS_AUTH_FIX_2025_11_12.md) - Authentication fix
- [ScraperService.ts](../src/services/ScraperService.ts) - Adapter implementation

## Additional Notes

### Why Three Program Types?

1. **yonote** - Scrape lessons from Yonote/Practicum platform
   - Requires authentication (cookie)
   - Auto-fetches lesson content
   - Updates when content changes

2. **generic_list** - Scrape from any website
   - No authentication required
   - Extracts links from page
   - Basic content extraction

3. **manual** - User uploads files
   - Full control over content
   - Works offline
   - No external dependencies
   - Best for custom content

### Security Considerations

File uploads are validated:

- File size limits enforced
- File type validation
- Content sanitization (for HTML/PDF)
- Stored in database, not file system
- RLS policies ensure users can only access their own files

## Monitoring

After deployment, monitor:

- Success rate of manual program lesson uploads
- Error rate of enumerate calls (should remain low)
- User feedback on file upload UX
- File upload latency for large files

## Conclusion

This fix ensures users can properly upload lessons for manual programs without encountering the "No adapter found" error. The UI now intelligently shows the appropriate action based on program type.
