import React, { useEffect, useState } from 'react';
import {
  Card,
  Text,
  DataTable,
  Button,
  Badge,
  BlockStack,
  Banner,
  Spinner,
  Modal,
  TextField,
  Select,
} from '@shopify/polaris';
import { api } from '../api/shopify';
import type { App, AppGraphSummary } from '../types';

export default function AppInventory() {
  const [graph, setGraph] = useState<AppGraphSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedApp, setSelectedApp] = useState<App | null>(null);
  const [modalActive, setModalActive] = useState(false);
  const [addModalActive, setAddModalActive] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Edit fields
  const [editName, setEditName] = useState('');
  const [editDev, setEditDev] = useState('');
  const [editCost, setEditCost] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editActive, setEditActive] = useState('true');

  // Add fields
  const [newName, setNewName] = useState('');
  const [newDev, setNewDev] = useState('');
  const [newCost, setNewCost] = useState('');
  const [newCategory, setNewCategory] = useState('Marketing & Conversion');
  const [newActive, setNewActive] = useState('true');
  const [newPerms, setNewPerms] = useState('read_products, write_products');

  const loadData = () => {
    setLoading(true);
    api.apps.getGraph().then((data) => {
      setGraph(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const handleCategorize = async () => {
    setRefreshing(true);
    try { await api.apps.categorize(); loadData(); }
    catch (e) { console.error(e); }
    setRefreshing(false);
  };

  const handleViewApp = (app: App) => {
    setSelectedApp(app);
    setEditName(app.name);
    setEditDev(app.developerName || '');
    setEditCost(app.monthlyCost?.toString() || '0');
    setEditCategory(app.category || '');
    setEditActive(app.isActive ? 'true' : 'false');
    setEditing(false);
    setConfirmDelete(false);
    setModalActive(true);
  };

  const handleAddApp = async () => {
    if (!newName.trim()) return;
    setRefreshing(true);
    try {
      await api.customApp.create({
        name: newName, developerName: newDev, monthlyCost: parseFloat(newCost) || 0,
        category: newCategory, isActive: newActive === 'true',
        permissions: newPerms.split(',').map(s => s.trim()).filter(Boolean),
      });
      setAddModalActive(false);
      setNewName(''); setNewDev(''); setNewCost('');
      loadData();
    } catch (e: any) { alert(e.message); }
    setRefreshing(false);
  };

  const handleSaveEdit = async () => {
    if (!selectedApp) return;
    setRefreshing(true);
    try {
      await api.customApp.update(selectedApp.id, {
        name: editName, developerName: editDev,
        monthlyCost: parseFloat(editCost) || 0, category: editCategory,
        isActive: editActive === 'true',
      });
      setEditing(false);
      setSelectedApp({ ...selectedApp, name: editName, developerName: editDev, monthlyCost: parseFloat(editCost) || 0, category: editCategory, isActive: editActive === 'true' });
      loadData();
    } catch (e: any) { alert(e.message); }
    setRefreshing(false);
  };

  const handleDeleteApp = async () => {
    if (!selectedApp) return;
    setRefreshing(true);
    try {
      await api.customApp.delete(selectedApp.id);
      setModalActive(false);
      setSelectedApp(null);
      setConfirmDelete(false);
      loadData();
    } catch (e: any) { alert(e.message); }
    setRefreshing(false);
  };

  if (loading) return <Spinner accessibilityLabel="Loading apps" />;

  const rows = graph?.apps.map((app) => [
    <Button variant="plain" onClick={() => handleViewApp(app)}>{app.name}</Button>,
    app.category || '-',
    app.monthlyCost ? `$${app.monthlyCost.toFixed(2)}` : 'Free',
    app.permissions.filter((p) => p.isHighRisk).length.toString(),
    <Badge tone={app.isActive ? 'success' : 'critical'}>{app.isActive ? 'Active' : 'Inactive'}</Badge>,
  ]) || [];

  return (
    <BlockStack gap="400">
      <div style={{display:"flex",justifyContent:"flex-end",gap:"var(--p-space-200)"}}>
        <Button onClick={() => setAddModalActive(true)}>Add Custom App</Button>
        <Button onClick={handleCategorize} loading={refreshing}>Auto-Categorize</Button>
      </div>

      <Card>
        <Text as="h3" variant="headingMd">
          App Inventory ({graph?.totalApps || 0} apps &middot; ${graph?.totalMonthlySpend.toFixed(2) || '0'}/mo)
        </Text>
        <DataTable
          columnContentTypes={['text', 'text', 'numeric', 'numeric', 'text']}
          headings={['App', 'Category', 'Cost/mo', 'High-Risk Scopes', 'Status']}
          rows={rows}
        />
      </Card>

      {/* View/Edit/Delete App Modal */}
      <Modal open={modalActive} onClose={() => setModalActive(false)} title={selectedApp?.name || ''}>
        {selectedApp && (
          <Modal.Section>
            <BlockStack gap="300">
              {!editing ? (
                <>
                  <Text as="p" variant="bodyMd">Developer: {selectedApp.developerName || 'Unknown'}</Text>
                  <Text as="p" variant="bodyMd">Handle: {selectedApp.handle}</Text>
                  <Text as="p" variant="bodyMd">Category: {selectedApp.category || 'Uncategorized'}</Text>
                  <Text as="p" variant="bodyMd">Cost: {selectedApp.monthlyCost ? `$${selectedApp.monthlyCost.toFixed(2)}/${selectedApp.billingInterval || 'mo'}` : 'Free'}</Text>
                  <Text as="p" variant="bodyMd">Installed: {new Date(selectedApp.installedAt).toLocaleDateString()}</Text>
                  <Text as="p" variant="bodyMd">Last Used: {selectedApp.lastUsedAt ? new Date(selectedApp.lastUsedAt).toLocaleDateString() : 'Never'}</Text>
                  <Text as="p" variant="bodyMd">Status: {selectedApp.isActive ? 'Active' : 'Inactive'}</Text>
                  <Text as="p" variant="headingSm" fontWeight="bold">Permissions</Text>
                  {selectedApp.permissions.map((p) => (
                    <Badge key={p.id} tone={p.isHighRisk ? 'critical' : 'success'}>{p.scope}</Badge>
                  ))}
                  <div style={{display:"flex",gap:"var(--p-space-200)",marginTop:"var(--p-space-400)"}}>
                    <Button onClick={() => setEditing(true)}>Edit</Button>
                    <Button tone="critical" onClick={() => setConfirmDelete(true)}>Delete App</Button>
                  </div>
                </>
              ) : (
                <>
                  <TextField label="Name" value={editName} onChange={setEditName} autoComplete="off" />
                  <TextField label="Developer" value={editDev} onChange={setEditDev} autoComplete="off" />
                  <TextField label="Monthly Cost ($)" value={editCost} onChange={setEditCost} type="number" autoComplete="off" />
                  <TextField label="Category" value={editCategory} onChange={setEditCategory} autoComplete="off" />
                  <Select label="Active" value={editActive} onChange={setEditActive}
                    options={[{ label: 'Yes', value: 'true' }, { label: 'No', value: 'false' }]}
                  />
                  <div style={{display:"flex",gap:"var(--p-space-200)"}}>
                    <Button variant="primary" onClick={handleSaveEdit} loading={refreshing}>Save</Button>
                    <Button onClick={() => setEditing(false)}>Cancel</Button>
                  </div>
                </>
              )}
            </BlockStack>
          </Modal.Section>
        )}
      </Modal>

      {/* Delete confirmation modal */}
      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete App?">
        <Modal.Section>
          <BlockStack gap="300">
            <Text as="p" variant="bodyMd">Are you sure you want to delete <strong>{selectedApp?.name}</strong>? This will remove all associated scores, compliance findings, and history.</Text>
            <div style={{display:"flex",gap:"var(--p-space-200)"}}>
              <Button tone="critical" onClick={handleDeleteApp} loading={refreshing}>Yes, Delete</Button>
              <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
            </div>
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* Add Custom App Modal */}
      <Modal open={addModalActive} onClose={() => setAddModalActive(false)} title="Add Custom App (for testing)">
        <Modal.Section>
          <BlockStack gap="300">
            <TextField label="App Name" value={newName} onChange={setNewName} autoComplete="off" />
            <TextField label="Developer" value={newDev} onChange={setNewDev} autoComplete="off" />
            <TextField label="Monthly Cost ($)" value={newCost} onChange={setNewCost} type="number" autoComplete="off" />
            <Select label="Category" value={newCategory} onChange={setNewCategory}
              options={[
                'Marketing & Conversion', 'Loyalty & Rewards', 'Shipping & Fulfillment',
                'Reviews', 'SEO', 'Analytics', 'Customer Service', 'Inventory', 'Sales', 'Design', 'Custom',
              ]}
            />
            <Select label="Active" value={newActive} onChange={setNewActive}
              options={[{ label: 'Yes', value: 'true' }, { label: 'No', value: 'false' }]}
            />
            <TextField label="Permission Scopes (comma-separated)" value={newPerms} onChange={setNewPerms} autoComplete="off"
              helpText='e.g. read_products, write_products, read_orders, read_customers, write_customers'
            />
            <Button variant="primary" onClick={handleAddApp} loading={refreshing}>Create App</Button>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </BlockStack>
  );
}
