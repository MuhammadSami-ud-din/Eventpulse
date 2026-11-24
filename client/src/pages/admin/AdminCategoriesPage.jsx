import { useState } from 'react';
import { createCategory, deleteCategory, fetchAdminCategories, updateCategory } from '../../api/admin.js';
import { AdminNav } from '../../components/AdminNav.jsx';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';
import { FormField } from '../../components/FormField.jsx';
import { TableSkeleton } from '../../components/Skeletons.jsx';
import { EmptyState, ErrorState } from '../../components/StateViews.jsx';
import { TableWrap } from '../../components/TableWrap.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useForm } from '../../hooks/useForm.js';
import { errorMessage, fieldErrors } from '../../utils/errors.js';
import { pluralize } from '../../utils/format.js';
import { rules } from '../../utils/validation.js';

// Mirrors the server: the link slug is built from Latin letters and digits,
// so a name needs at least one (accents are fine: "É" counts as "E").
const SCHEMA = {
  name: [
    rules.required('Name'),
    rules.plainText('Name'),
    (value) => (value.trim().length >= 2 ? null : 'Name is too short'),
    rules.maxLength(50, 'Name'),
    (value) => (/[a-z0-9]/i.test(value.normalize('NFKD')) ? null : 'Use at least one letter or digit (A-Z, 0-9)'),
  ],
  description: [rules.plainText('Description'), rules.maxLength(255, 'Description')],
};

// Adds a category, or edits `category` when given. The parent remounts it
// (via `key`) to switch between the two, which also resets the fields.
function CategoryForm({ category, onSaved, onCancel }) {
  const form = useForm({ name: category?.name ?? '', description: category?.description ?? '' }, SCHEMA);
  const [formError, setFormError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    try {
      const saved = await form.submitWith((values) =>
        category ? updateCategory(category.id, values) : createCategory(values),
      );
      if (saved) onSaved(category ? 'Category updated.' : 'Category added.');
    } catch (error) {
      // A duplicate name comes back as an error on the name field itself.
      if (Object.keys(fieldErrors(error)).length === 0) setFormError(errorMessage(error));
    }
  }

  return (
    <form className="card category-form" onSubmit={handleSubmit} noValidate>
      <h2>{category ? `Edit “${category.name}”` : 'Add a category'}</h2>
      {formError && (
        <p className="form-error" role="alert">
          {formError}
        </p>
      )}
      <FormField label="Name" maxLength={50} autoFocus={Boolean(category)} {...form.field('name')} />
      <FormField
        label="Description (optional)"
        maxLength={255}
        hint={category ? `The filter link stays /?category=${category.slug} after a rename.` : undefined}
        {...form.field('description')}
      />
      <div className="form-actions">
        {category && (
          <button type="button" className="button button--ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="button button--primary" disabled={form.submitting}>
          {form.submitting ? 'Saving…' : category ? 'Save changes' : 'Add category'}
        </button>
      </div>
    </form>
  );
}

export function AdminCategoriesPage() {
  useDocumentTitle('Categories');
  const { showToast } = useToast();
  const categories = useAsync((signal) => fetchAdminCategories({ signal }), []);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  // Bumped after each add, so a fresh, empty form is mounted.
  const [formVersion, setFormVersion] = useState(0);

  function handleSaved(message) {
    showToast({ type: 'success', message });
    setEditing(null);
    setFormVersion((version) => version + 1);
    categories.reload();
  }

  async function confirmDelete() {
    setBusy(true);
    try {
      await deleteCategory(deleting.id);
      showToast({ type: 'success', message: `Deleted “${deleting.name}”.` });
      setDeleting(null);
      categories.reload();
    } catch (error) {
      showToast({ type: 'error', message: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Admin</h1>
      <AdminNav />
      <div className="categories-layout">
        <CategoryForm
          key={editing ? `edit-${editing.id}` : `new-${formVersion}`}
          category={editing}
          onSaved={handleSaved}
          onCancel={() => setEditing(null)}
        />

        <div>
          {categories.isLoading && <TableSkeleton label="Loading categories…" columns={3} />}
          {categories.error && <ErrorState error={categories.error} onRetry={categories.reload} />}
          {categories.data?.length === 0 && <EmptyState title="No categories yet" message="Add the first one." />}
          {categories.data?.length > 0 && (
            <TableWrap label="Categories" busy={categories.isFetching}>
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Category</th>
                    <th scope="col">Filter link</th>
                    <th scope="col" className="table__number">
                      Events
                    </th>
                    <th scope="col">
                      <span className="visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {categories.data.map((category) => (
                    <tr key={category.id}>
                      <td>
                        <span className="table__primary">{category.name}</span>
                        {category.description && <span className="table__secondary">{category.description}</span>}
                      </td>
                      <td>
                        <code>/?category={category.slug}</code>
                      </td>
                      <td className="table__number">{category.eventCount}</td>
                      <td>
                        <div className="row-actions">
                          <button type="button" className="button button--small" onClick={() => setEditing(category)}>
                            Edit
                          </button>
                          {category.eventCount === 0 ? (
                            <button
                              type="button"
                              className="button button--small button--danger-outline"
                              onClick={() => setDeleting(category)}
                            >
                              Delete
                            </button>
                          ) : (
                            <span className="row-actions__note">In use, can’t delete</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
          {categories.data?.length > 0 && (
            <p className="field__hint">
              {pluralize(categories.data.length, 'category', 'categories')}. Only a category that no event uses can be
              deleted.
            </p>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete “${deleting?.name ?? ''}”?`}
        message="No events use it. Organizers will no longer be able to pick it."
        confirmLabel="Delete category"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
        busy={busy}
      />
    </>
  );
}
