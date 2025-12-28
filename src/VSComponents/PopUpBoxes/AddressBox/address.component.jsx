// src/components/Database/DisplayPatient/Patient/address.component.jsx
import React from 'react';
import DragBox from '../../DragBox/Drag/dragBox.component.jsx';
import { useGlobalContext } from "../../../Context/global.context.jsx";

const AddressBox = ({ activePatient, user }) => {
  const { selectedTopButtons, setSelectedTopButtons, setActivePatient } = useGlobalContext();
  const patient = activePatient || {};

  // ----- edit state -----
  const [editing, setEditing] = React.useState(false);

  // snapshot of original values for dirty/cancel logic
  const originalRef = React.useRef({
    fullAddress: patient.fullAddress ?? '',
    street: patient.street ?? '',
    city: patient.city ?? '',
    province: patient.province ?? '',
    postalCode: patient.postalCode ?? '',
    telephone: patient.telephone ?? '',
  });

  // controlled form model
  const [form, setForm] = React.useState(originalRef.current);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState('');

  // when switching patients, reset everything
  React.useEffect(() => {
    const next = {
      fullAddress: activePatient?.fullAddress ?? '',
      street: activePatient?.street ?? '',
      city: activePatient?.city ?? '',
      province: activePatient?.province ?? '',
      postalCode: activePatient?.postalCode ?? '',
      telephone: activePatient?.telephone ?? '',
    };
    originalRef.current = next;
    setForm(next);
    setEditing(false);
    setMsg('');
  }, [activePatient?.id]);

  const isDirty =
    form.fullAddress !== originalRef.current.fullAddress ||
    form.street !== originalRef.current.street ||
    form.city !== originalRef.current.city ||
    form.province !== originalRef.current.province ||
    form.postalCode !== originalRef.current.postalCode ||
    form.telephone !== originalRef.current.telephone;

  const onChange = (field) => (e) => {
    const val = e.target.value;
    setForm((f) => ({ ...f, [field]: val }));
  };

  // --- Save (same success/affected_rows contract as your other saves) ---
  const sendSave = async () => {
    if (!activePatient?.id) return;

    setSaving(true);
    setMsg('');

    const payload = {
      script: 'saveAddress',
      patientID: activePatient.id,
      patientDB: user?.patientTable || 'Patient',
      historyDB: user?.historyTable || 'Patient_History',
      fullAddress: form.fullAddress,
      street: form.street,
      city: form.city,
      province: form.province,
      postalCode: form.postalCode,
      telephone: form.telephone,
    };

    try {
      const resp = await fetch('https://gdmt.ca/PHP/database.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();

      if (data?.success) {
        if (Number(data?.affected_rows) === 1) {
          // commit to "original"
          originalRef.current = { ...form };
          // update activePatient in context so UI reflects new address
          if (typeof setActivePatient === 'function') {
            setActivePatient((prev) => ({
              ...(prev || activePatient || {}),
              fullAddress: form.fullAddress,
              street: form.street,
              city: form.city,
              province: form.province,
              postalCode: form.postalCode,
              telephone: form.telephone,
            }));
          }
          setMsg('Saved.');
          setEditing(false); // leave edit mode after successful save
        } else {
          setMsg('Nothing changed.');
        }
      } else {
        setMsg(data?.error || data?.message || 'Error saving address.');
      }
    } catch (e) {
      setMsg('Error saving address.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // revert values and exit edit mode
    setForm(originalRef.current);
    setMsg('Reverted.');
    setEditing(false);
  };

  const renderRow = (label, value) => (
    <div className="d-flex mb-2 fs-7">
      <strong className="me-2" style={{ minWidth: '150px' }}>{label}:</strong>
      <span>{value || '—'}</span>
    </div>
  );

  return (
    <DragBox
      id="ADDRESS"
      storageKey="ADDRESS_POSITION"
      defaultPos={{ x: 300, y: 340 }}
      title="Complete Address [FULLY WORKING]"
      isOpen={selectedTopButtons.includes('address')}
      width={800}
      onAdd={null}
      zIndex={2050}
      addNote="-" // no header button; we control with top-right "Edit"
      onClose={() => {
        const updatedButtons = (selectedTopButtons || []).filter(btn => btn !== 'address');
        setSelectedTopButtons?.(updatedButtons);
      }}
    >
      <div className="border p-3 rounded bg-light">
        {/* Top action bar (inside body, aligned right) */}
        <div className="d-flex align-items-center mb-2">
          <div className="ms-auto d-flex gap-2">
            {!editing ? (
              // EDIT (view mode)
              <button
                className="btn btn-sm btn-outline-primary"
                onClick={() => setEditing(true)}
                title="Edit address"
              >
                Edit
              </button>
            ) : (
              <>
                {/* SAVE (edit mode): outline until dirty → solid; disabled until dirty */}
                <button
                  className={`btn btn-sm ${isDirty ? 'btn-success text-white' : 'btn-outline-success'}`}
                  disabled={!isDirty || saving}
                  onClick={sendSave}
                  title={isDirty ? 'Save changes' : 'No changes to save'}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>

                {/* CANCEL (edit mode): always visible; exits edit + reverts */}
                <button
                  className="btn btn-sm btn-outline-secondary"
                  disabled={saving}
                  onClick={handleCancel}
                  title="Cancel editing"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>

        {!editing ? (
          <>
            <div className="mb-4">
              <h5>Address & Contact</h5>
              {renderRow('Full Address', patient.fullAddress)}
              {renderRow('Street', patient.street)}
              {renderRow('City', patient.city)}
              {renderRow('Province', patient.province)}
              {renderRow('Postal Code', patient.postalCode)}
              {renderRow('Telephone', patient.telephone)}
            </div>

            <div>
              <h5>Provider Info</h5>
              {renderRow('Provider Name', patient.providerName)}
              {renderRow('Provider Number', patient.providerNumber)}
              {renderRow('Order Date', patient.orderDate)}
            </div>
          </>
        ) : (
          <>
            <div className="mb-4">
              <h5>Edit Address & Contact</h5>

              <div className="row g-2">
                <div className="col-48">
                  <label className="form-label mb-0 small">Full Address</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={form.fullAddress}
                    onChange={onChange('fullAddress')}
                    placeholder="123 Main St, City, Province"
                  />
                </div>

                <div className="col-24">
                  <label className="form-label mb-0 small">Street</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={form.street}
                    onChange={onChange('street')}
                    placeholder="Street"
                  />
                </div>

                <div className="col-12">
                  <label className="form-label mb-0 small">City</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={form.city}
                    onChange={onChange('city')}
                    placeholder="City"
                  />
                </div>

                <div className="col-6">
                  <label className="form-label mb-0 small">Province</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={form.province}
                    onChange={onChange('province')}
                    placeholder="Province"
                  />
                </div>

                <div className="col-6">
                  <label className="form-label mb-0 small">Postal Code</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={form.postalCode}
                    onChange={onChange('postalCode')}
                    placeholder="A1A 1A1"
                  />
                </div>

                <div className="col-12">
                  <label className="form-label mb-0 small">Telephone</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={form.telephone}
                    onChange={onChange('telephone')}
                    placeholder="(555) 555-5555"
                  />
                </div>
              </div>
            </div>

            {/* Provider display (not editing here unless you want to) */}
            <div>
              <h5>Provider Info</h5>
              {renderRow('Provider Name', patient.providerName)}
              {renderRow('Provider Number', patient.providerNumber)}
              {renderRow('Order Date', patient.orderDate)}
            </div>
          </>
        )}

        {msg && <div className="small mt-2 text-muted">{msg}</div>}
      </div>
    </DragBox>
  );
};

export default AddressBox;
