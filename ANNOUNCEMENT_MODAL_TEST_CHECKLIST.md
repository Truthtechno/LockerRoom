# Announcement Modal Test Checklist

## Fixed Issues ✅

1. **Fixed "Target school ID required" error**
   - Backend now properly handles `targetSchoolIds` array
   - Frontend validates school selection before submission
   - Better error messages

2. **Removed XEN Staff option**
   - Removed from scope dropdown
   - Removed from edit modal
   - Updated descriptions

3. **Made all fields responsive**
   - Modal width: 95vw on mobile, max-w-[600px] on desktop
   - Title/Content fields: Full width with character counters
   - School selector: Responsive layout with break-words
   - Upload buttons: Full width on mobile, auto on desktop
   - Footer buttons: Stack on mobile, side-by-side on desktop

## Field Responsiveness Testing

### ✅ Title Field
- [ ] Full width on all screen sizes
- [ ] Character counter displays correctly
- [ ] Max 200 characters enforced
- [ ] Responsive placeholder text

### ✅ Content Field
- [ ] Full width on all screen sizes
- [ ] Character counter displays correctly
- [ ] Max 2000 characters enforced
- [ ] Resizable textarea
- [ ] Minimum height: 100px

### ✅ Scope Selection
- [ ] Full width dropdown
- [ ] Only shows "All Schools" and "Specific Schools"
- [ ] No XEN Staff option
- [ ] Responsive on mobile/tablet/desktop

### ✅ School Selection (When "Specific Schools" selected)
- [ ] Checkbox list appears
- [ ] "Select All/Deselect All" button responsive
- [ ] Scrollable container (max-h-48 on mobile, max-h-64 on desktop)
- [ ] School names wrap properly (break-words)
- [ ] Selection counter displays
- [ ] Error message shows if no schools selected
- [ ] Works on mobile, tablet, and desktop

### ✅ Image Upload
- [ ] Button full width on mobile
- [ ] Button auto width on desktop
- [ ] Upload progress indicator
- [ ] File preview responsive
- [ ] Remove button accessible

### ✅ Video Upload
- [ ] Button full width on mobile
- [ ] Button auto width on desktop
- [ ] Upload progress indicator
- [ ] File preview responsive
- [ ] Remove button accessible

### ✅ Manual URL Inputs
- [ ] Full width fields
- [ ] Responsive on all screen sizes
- [ ] Proper URL validation

### ✅ Action Buttons (Footer)
- [ ] Stack vertically on mobile
- [ ] Side-by-side on desktop
- [ ] "Create Announcement" button appears first on mobile (for better UX)
- [ ] Both buttons full width on mobile
- [ ] Proper disabled states during loading/uploading

## Functional Testing

### ✅ Form Validation
- [ ] Title required validation
- [ ] Content required validation
- [ ] School selection required when scope is "school"
- [ ] Proper error messages displayed

### ✅ School Selection
- [ ] Schools load when modal opens (system admin only)
- [ ] Checkboxes work correctly
- [ ] Select All/Deselect All works
- [ ] Selection persists when changing other fields
- [ ] Selection clears when changing scope away from "school"

### ✅ Submission
- [ ] "All Schools" scope creates global announcement
- [ ] "Specific Schools" scope creates one announcement per selected school
- [ ] Success message shows correct count
- [ ] Form resets after successful submission
- [ ] Modal closes after successful submission

### ✅ Error Handling
- [ ] Network errors handled gracefully
- [ ] Validation errors show user-friendly messages
- [ ] Backend errors displayed correctly

## Cross-Device Testing

### Mobile (< 640px)
- [ ] Modal takes 95% viewport width
- [ ] All fields stack appropriately
- [ ] Buttons full width
- [ ] Text readable without zooming
- [ ] School list scrollable
- [ ] Keyboard accessible

### Tablet (640px - 1024px)
- [ ] Modal properly sized
- [ ] Good spacing between elements
- [ ] Buttons appropriately sized
- [ ] Form fields comfortable width

### Desktop (> 1024px)
- [ ] Modal max-width 600px
- [ ] Optimal spacing
- [ ] All features easily accessible

## Browser Testing

Test on:
- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Edge

## Accessibility Testing

- [ ] All fields have proper labels
- [ ] Form is keyboard navigable
- [ ] Error messages are announced
- [ ] Focus indicators visible
- [ ] Color contrast meets WCAG standards

