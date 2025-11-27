---
description: Commit changes, merge to main, push to GitHub, and create a new branch
---

Please perform the following steps:

1. **Commit current changes:**
   - Check git status to see all changes
   - Review the git diff to understand what has changed
   - Create a commit with a suitable commit message based on the code changes
   - The commit message should follow this format:

     ```
     <brief summary>

     <optional detailed description if needed>
     ```

2. **Create checkpoint tag:**
   - Before merging, create a git tag to mark this checkpoint
   - Tag name format: `checkpoint-{current-branch-name}-{YYYY-MM-DD-HH-MM}`
   - Example: `checkpoint-workout-ux-functionality-2025-11-10-14-30`
   - Use `git tag -a` with a message like: "Checkpoint before merging {branch-name} to main"
   - This creates a rollback point that preserves the exact state before merging

3. **Merge to main branch:**
   - Switch to the main branch
   - Merge the previous branch into main
   - If there are merge conflicts, resolve them automatically where possible
   - If conflicts cannot be automatically resolved, show the conflicts and ask for guidance
   - After successful merge, verify the merge was successful

4. **Push to GitHub:**
   - Push the main branch to the remote repository (origin)
   - Push all tags to the remote repository: `git push origin --tags`
   - Confirm the push was successful

5. **Create new branch:**
   - Create and switch to a new branch named: $ARGUMENTS
   - Confirm the new branch was created successfully

If there are no changes to commit (working tree is clean), skip step 1 and proceed directly to step 2 (creating checkpoint tag), then merge, push, and create the new branch.
