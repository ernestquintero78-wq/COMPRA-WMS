import React, { useState, useEffect } from 'react';
import { 
  UserCheck, 
  Shield, 
  Plus, 
  Key, 
  LogIn, 
  ChevronRight, 
  Laptop, 
  UserPlus, 
  Edit, 
  Phone, 
  Building2, 
  Save, 
  X, 
  Trash2, 
  Lock, 
  Unlock, 
  Briefcase, 
  ShieldAlert, 
  AlertCircle, 
  RefreshCw, 
  Layers,
  Eye,
  EyeOff
} from 'lucide-react';

export interface OperatorProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  pin: string;
  deviceId: string;
  createdAt: string;
  contactNumber?: string;
  department?: string;
  hierarchy: 'Administrador' | 'Supervisor' | 'Operario';
  status: 'Activo' | 'Inactivo';
}

export interface WmsPosition {
  id: string;
  name: string;
  hierarchy: 'Administrador' | 'Supervisor' | 'Operario';
  description?: string;
}

interface CrewManagerProps {
  activeOperator: OperatorProfile | null;
  onSelectOperator: (profile: OperatorProfile | null) => void;
  platformUser?: any;
}

export const CrewManager: React.FC<CrewManagerProps> = ({ activeOperator, onSelectOperator, platformUser }) => {
  const [crewList, setCrewList] = useState<OperatorProfile[]>([]);
  const [positions, setPositions] = useState<WmsPosition[]>([]);
  
  const getPlatformRole = () => {
    if (!platformUser) return 'Operador';
    const email = platformUser.email?.toLowerCase().trim();
    if (
      email === 'it.escalanegocios@gmail.com' ||
      email === 'ernest.quintero78@gmail.com' ||
      email === 'ernest.quintero78@gmail.'
    ) {
      return 'Administrador General';
    }
    if (email === 'supervisor@owms.com') {
      return 'Supervisor de Turno';
    }
    return 'Operador';
  };

  const platformRole = getPlatformRole();
  const isReadOnly = platformRole === 'Operador';
  
  // Tab navigation inside Crew Manager
  const [activeSubTab, setActiveSubTab] = useState<'crew' | 'positions'>('crew');

  // Register crew form fields
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedRoleName, setSelectedRoleName] = useState('');
  const [pin, setPin] = useState('');
  const [deviceId, setDeviceId] = useState('ZEBRA-TC21-01');
  const [contactNumber, setContactNumber] = useState('');
  const [department, setDepartment] = useState('');

  // Register position form fields
  const [showPositionForm, setShowPositionForm] = useState(false);
  const [newPosName, setNewPosName] = useState('');
  const [newPosHierarchy, setNewPosHierarchy] = useState<'Administrador' | 'Supervisor' | 'Operario'>('Operario');
  const [newPosDesc, setNewPosDesc] = useState('');

  // Edit profile form fields
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRoleName, setEditRoleName] = useState('');
  const [editPin, setEditPin] = useState('');
  const [showEditPin, setShowEditPin] = useState(false);
  const [showRegisterPin, setShowRegisterPin] = useState(false);
  const [editDeviceId, setEditDeviceId] = useState('');
  const [editContactNumber, setEditContactNumber] = useState('');
  const [editDepartment, setEditDepartment] = useState('');

  // Details card of selected crew member in directory
  const [detailedMemberId, setDetailedMemberId] = useState<string>('');

  // Sign in form fields
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [inputPin, setInputPin] = useState('');
  const [loginError, setLoginError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Initial load
  useEffect(() => {
    // 1. Load Positions
    const savedPos = localStorage.getItem('OWMS_CREW_POSITIONS');
    let loadedPositions: WmsPosition[] = [];
    if (savedPos) {
      loadedPositions = JSON.parse(savedPos);
      setPositions(loadedPositions);
    } else {
      const defaultPositions: WmsPosition[] = [
        { id: 'pos-1', name: 'Administrador de WMS', hierarchy: 'Administrador', description: 'Acceso total y configuración técnica del almacén.' },
        { id: 'pos-2', name: 'Supervisor de WMS', hierarchy: 'Supervisor', description: 'Gestión operacional, asignación de tareas y auditorías.' },
        { id: 'pos-3', name: 'Operario de Picking', hierarchy: 'Operario', description: 'Surtido de pedidos, escaneo de códigos de barra.' },
        { id: 'pos-4', name: 'Montacarguista', hierarchy: 'Operario', description: 'Colocación en altura y reubicación de tarimas.' },
        { id: 'pos-5', name: 'Analista de Entrada', hierarchy: 'Operario', description: 'Recepción, validación y conteo de mercancía entrante.' }
      ];
      setPositions(defaultPositions);
      loadedPositions = defaultPositions;
      localStorage.setItem('OWMS_CREW_POSITIONS', JSON.stringify(defaultPositions));
    }

    if (loadedPositions.length > 0) {
      setSelectedRoleName(loadedPositions[0].name);
    }

    // 2. Load Crew Members
    const savedCrew = localStorage.getItem('OWMS_CREW_MEMBERS');
    if (savedCrew) {
      const rawCrew = JSON.parse(savedCrew);
      // Migrate / ensure hierarchy and status exist
      let migratedCrew = rawCrew.map((c: any) => {
        let h = c.hierarchy;
        if (!h) {
          if (c.role === 'Supervisor de WMS' || c.role?.toLowerCase().includes('supervisor')) {
            h = 'Supervisor';
          } else if (c.role?.toLowerCase().includes('administrador') || c.role?.toLowerCase().includes('admin')) {
            h = 'Administrador';
          } else {
            h = 'Operario';
          }
        }
        return {
          ...c,
          hierarchy: h,
          status: c.status || 'Activo'
        };
      });

      // Ensure IT Escala Negocios admin is present in crew members
      if (!migratedCrew.some((c: any) => c.email?.toLowerCase() === 'it.escalanegocios@gmail.com')) {
        migratedCrew.unshift({
          id: 'ADM-001',
          name: 'IT Escala Negocios',
          email: 'it.escalanegocios@gmail.com',
          role: 'Administrador de WMS',
          pin: '0000',
          deviceId: 'SERVER-IT-01',
          createdAt: new Date().toISOString(),
          contactNumber: '+34 600 000 000',
          department: 'Dirección e IT',
          hierarchy: 'Administrador',
          status: 'Activo'
        });
      }

      setCrewList(migratedCrew);
      localStorage.setItem('OWMS_CREW_MEMBERS', JSON.stringify(migratedCrew));
    } else {
      const defaultCrew: OperatorProfile[] = [
        {
          id: 'ADM-001',
          name: 'IT Escala Negocios',
          email: 'it.escalanegocios@gmail.com',
          role: 'Administrador de WMS',
          pin: '0000',
          deviceId: 'SERVER-IT-01',
          createdAt: new Date().toISOString(),
          contactNumber: '+34 600 000 000',
          department: 'Dirección e IT',
          hierarchy: 'Administrador',
          status: 'Activo'
        },
        {
          id: 'OP-101',
          name: 'Alex Mercer',
          email: 'alex.mercer@warehouse.com',
          role: 'Operario de Picking',
          pin: '1234',
          deviceId: 'ZEBRA-TC21-04',
          createdAt: new Date().toISOString(),
          contactNumber: '+34 612 345 678',
          department: 'Preparación de Pedidos',
          hierarchy: 'Operario',
          status: 'Activo'
        },
        {
          id: 'OP-102',
          name: 'María Delgado',
          email: 'maria.delgado@warehouse.com',
          role: 'Analista de Entrada',
          pin: '2222',
          deviceId: 'HONEYWELL-D70-01',
          createdAt: new Date().toISOString(),
          contactNumber: '+34 623 456 789',
          department: 'Recepción e Inventario',
          hierarchy: 'Operario',
          status: 'Activo'
        },
        {
          id: 'OP-103',
          name: 'Héctor Gómez',
          email: 'hector.gomez@warehouse.com',
          role: 'Montacarguista',
          pin: '8888',
          deviceId: 'ZEBRA-TC52-09',
          createdAt: new Date().toISOString(),
          contactNumber: '+34 634 567 890',
          department: 'Almacenamiento y Alturas',
          hierarchy: 'Operario',
          status: 'Activo'
        },
        {
          id: 'OP-104',
          name: 'Juan Supervisor',
          email: 'juan.supervisor@warehouse.com',
          role: 'Supervisor de WMS',
          pin: '9999',
          deviceId: 'ZEBRA-TC52-12',
          createdAt: new Date().toISOString(),
          contactNumber: '+34 645 678 901',
          department: 'Supervisión General',
          hierarchy: 'Supervisor',
          status: 'Activo'
        },
        {
          id: 'OP-105',
          name: 'Sofía Administradora',
          email: 'sofia.admin@warehouse.com',
          role: 'Administrador de WMS',
          pin: '0000',
          deviceId: 'ZEBRA-TC52-20',
          createdAt: new Date().toISOString(),
          contactNumber: '+34 656 789 012',
          department: 'Sistemas WMS',
          hierarchy: 'Administrador',
          status: 'Activo'
        }
      ];
      setCrewList(defaultCrew);
      localStorage.setItem('OWMS_CREW_MEMBERS', JSON.stringify(defaultCrew));
    }
  }, []);

  const saveCrew = (updatedList: OperatorProfile[]) => {
    setCrewList(updatedList);
    localStorage.setItem('OWMS_CREW_MEMBERS', JSON.stringify(updatedList));
  };

  const savePositions = (updatedList: WmsPosition[]) => {
    setPositions(updatedList);
    localStorage.setItem('OWMS_CREW_POSITIONS', JSON.stringify(updatedList));
  };

  // Helper to determine the permission levels of the active operator
  const getActiveClearance = () => {
    if (!activeOperator) {
      return { hierarchy: 'Administrador' as const, label: 'Administrador de WMS (Default)', canModify: true, canManageCrew: true };
    }
    return {
      hierarchy: activeOperator.hierarchy,
      label: `${activeOperator.name} (${activeOperator.role})`,
      canModify: activeOperator.hierarchy !== 'Operario',
      canManageCrew: activeOperator.hierarchy === 'Administrador' || activeOperator.hierarchy === 'Supervisor'
    };
  };

  const clearance = getActiveClearance();

  // Helper to check if current logged-in operator can manage another member's profile
  const canManageMember = (member: OperatorProfile) => {
    // If no active operator is logged in, default admin has full control
    if (!activeOperator) return true;

    // Operarios cannot manage anyone
    if (activeOperator.hierarchy === 'Operario') return false;

    // Supervisors can only manage Operarios
    if (activeOperator.hierarchy === 'Supervisor') {
      return member.hierarchy === 'Operario';
    }

    // Administrators can manage anyone, but cannot suspend/delete themselves
    if (activeOperator.hierarchy === 'Administrador') {
      return activeOperator.id !== member.id;
    }

    return false;
  };

  // Register new operator
  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!clearance.canManageCrew) {
      setErrorMsg('No tiene permisos suficientes (Supervisor o Administrador) para dar de alta personal.');
      return;
    }

    if (!name.trim() || !email.trim() || !pin.trim()) {
      setErrorMsg('Complete todos los campos obligatorios.');
      return;
    }

    if (crewList.some(c => c.email.toLowerCase() === email.toLowerCase().trim())) {
      setErrorMsg('Error: Este correo electrónico ya está registrado.');
      return;
    }

    // Get hierarchy linked to position
    const matchedPos = positions.find(p => p.name === selectedRoleName);
    const resolvedHierarchy = matchedPos ? matchedPos.hierarchy : 'Operario';

    // Supervisors cannot create Supervisor or Administrator accounts
    if (activeOperator && activeOperator.hierarchy === 'Supervisor' && resolvedHierarchy !== 'Operario') {
      setErrorMsg('Como Supervisor, solo puede registrar personal con jerarquía de "Operario".');
      return;
    }

    const newProfile: OperatorProfile = {
      id: `OP-${Math.floor(200 + Math.random() * 800)}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role: selectedRoleName,
      pin: pin.trim(),
      deviceId,
      createdAt: new Date().toISOString(),
      contactNumber: contactNumber.trim() || undefined,
      department: department.trim() || undefined,
      hierarchy: resolvedHierarchy,
      status: 'Activo'
    };

    const nextCrew = [newProfile, ...crewList];
    saveCrew(nextCrew);

    // Reset fields
    setName('');
    setEmail('');
    setPin('');
    setDeviceId('ZEBRA-TC21-01');
    setContactNumber('');
    setDepartment('');
    setShowRegisterForm(false);
    setSuccessMsg(`¡Registro Exitoso! El operador ${newProfile.name} ha sido dado de alta en el sistema como ${newProfile.role}.`);
    setTimeout(() => setSuccessMsg(''), 6000);
  };

  // Login operator
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setSuccessMsg('');

    const targetProfile = crewList.find(c => c.id === selectedProfileId);
    if (!targetProfile) {
      setLoginError('Por favor, seleccione un perfil de operario válido.');
      return;
    }

    // Check if system access is revoked (quitar acceso al sistema)
    if (targetProfile.status === 'Inactivo') {
      setLoginError('Acceso Denegado: La cuenta de este operario ha sido desactivada o dada de baja.');
      return;
    }

    if (targetProfile.pin !== inputPin.trim()) {
      setLoginError('Código PIN inválido de operario. Intente nuevamente.');
      return;
    }

    // Success login
    onSelectOperator(targetProfile);
    setInputPin('');
    setSuccessMsg(`Sesión iniciada con éxito para ${targetProfile.name}.`);
    setTimeout(() => setSuccessMsg(''), 6000);
  };

  const handleLogoutOperator = () => {
    onSelectOperator(null);
    setIsEditingProfile(false);
    setSuccessMsg('Sesión de operario finalizada. Volviendo al rol de Administración Central.');
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  // Profile editing
  const handleStartEdit = (member: OperatorProfile) => {
    setEditName(member.name);
    setEditEmail(member.email);
    setEditRoleName(member.role);
    setEditPin(member.pin);
    setEditDeviceId(member.deviceId);
    setEditContactNumber(member.contactNumber || '');
    setEditDepartment(member.department || '');
    setIsEditingProfile(true);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    
    const editingMember = crewList.find(c => c.id === (activeOperator?.id || detailedMemberId));
    if (!editingMember) return;

    // Check permissions: A user can edit their own profile, or an authorized manager can edit it
    const isSelfEdit = activeOperator && activeOperator.id === editingMember.id;
    const isManagerEdit = clearance.canManageCrew && canManageMember(editingMember);

    if (!isSelfEdit && !isManagerEdit) {
      setErrorMsg('No tiene permisos suficientes para editar el perfil de este operario.');
      return;
    }

    if (!editName.trim() || !editEmail.trim() || !editPin.trim() || !editDeviceId.trim()) {
      setErrorMsg('Por favor complete todos los campos requeridos.');
      return;
    }

    const matchedPos = positions.find(p => p.name === editRoleName);
    const resolvedHierarchy = matchedPos ? matchedPos.hierarchy : editingMember.hierarchy;

    // Safety checks on hierarchy elevation
    if (activeOperator && activeOperator.hierarchy === 'Supervisor' && resolvedHierarchy !== 'Operario' && editingMember.hierarchy === 'Operario') {
      setErrorMsg('Como Supervisor, no puede elevar a un operador a un rol de nivel superior (Supervisor o Administrador).');
      return;
    }

    const updatedProfile: OperatorProfile = {
      ...editingMember,
      name: editName.trim(),
      email: editEmail.trim().toLowerCase(),
      role: editRoleName,
      pin: editPin.trim(),
      deviceId: editDeviceId.trim(),
      contactNumber: editContactNumber.trim() || undefined,
      department: editDepartment.trim() || undefined,
      hierarchy: resolvedHierarchy
    };

    const updatedCrewList = crewList.map(c => c.id === editingMember.id ? updatedProfile : c);
    saveCrew(updatedCrewList);

    // If edited profile was the active operator, update state
    if (activeOperator && activeOperator.id === editingMember.id) {
      onSelectOperator(updatedProfile);
    }

    setIsEditingProfile(false);
    setSuccessMsg(`¡El perfil de ${updatedProfile.name} ha sido actualizado con éxito!`);
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  // Toggle user status: Revoke system access / activate access
  const handleToggleStatus = (member: OperatorProfile) => {
    setErrorMsg('');
    if (!canManageMember(member)) {
      alert('Error: No posee jerarquía suficiente para alterar el estado de acceso de este operario.');
      return;
    }

    const nextStatus = member.status === 'Activo' ? 'Inactivo' : 'Activo';
    const updated = crewList.map(c => {
      if (c.id === member.id) {
        return { ...c, status: nextStatus };
      }
      return c;
    });

    saveCrew(updated);

    const msg = nextStatus === 'Activo' 
      ? `Acceso RESTAURADO. El operario ${member.name} ahora puede volver a ingresar al sistema.` 
      : `Acceso REVOCADO. Se ha denegado el acceso al sistema de ${member.name}.`;
    
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 6000);

    // If the suspended user is currently logged in, force sign out!
    if (activeOperator && activeOperator.id === member.id && nextStatus === 'Inactivo') {
      handleLogoutOperator();
    }
  };

  // Terminate personnel completely (Dar de baja personal)
  const handleDeleteMember = (member: OperatorProfile) => {
    setErrorMsg('');
    if (!canManageMember(member)) {
      alert('Error: No posee jerarquía suficiente para dar de baja definitiva a este operario.');
      return;
    }

    const confirmed = window.confirm(
      `¿Está completamente seguro de dar de BAJA DEFINITIVA al operario ${member.name}? \n\nEsta acción eliminará su registro de personal y desactivará de forma permanente todo acceso al sistema.`
    );
    if (!confirmed) return;

    const updated = crewList.filter(c => c.id !== member.id);
    saveCrew(updated);

    setSuccessMsg(`Baja Operacional Procesada: El registro de ${member.name} ha sido eliminado definitivamente del sistema.`);
    setTimeout(() => setSuccessMsg(''), 6000);

    // Clear details if selected
    if (detailedMemberId === member.id) {
      setDetailedMemberId('');
    }

    // Force log out if they were active
    if (activeOperator && activeOperator.id === member.id) {
      handleLogoutOperator();
    }
  };

  // Register custom position (Dar de alta nueva posición)
  const handleAddPosition = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!clearance.canManageCrew) {
      setErrorMsg('Permisos insuficientes para crear nuevas posiciones operacionales.');
      return;
    }

    if (!newPosName.trim()) {
      setErrorMsg('Proporcione un nombre válido para la nueva posición.');
      return;
    }

    const formattedName = newPosName.trim();
    if (positions.some(p => p.name.toLowerCase() === formattedName.toLowerCase())) {
      setErrorMsg('Error: Ya existe una posición registrada con ese nombre.');
      return;
    }

    // Supervisors cannot create positions with Supervisor or Administrador clearance
    if (activeOperator && activeOperator.hierarchy === 'Supervisor' && newPosHierarchy !== 'Operario') {
      setErrorMsg('Como Supervisor, solo puede registrar nuevas posiciones con jerarquía "Operario".');
      return;
    }

    const newPos: WmsPosition = {
      id: `pos-${Date.now()}`,
      name: formattedName,
      hierarchy: newPosHierarchy,
      description: newPosDesc.trim() || undefined
    };

    const nextPos = [...positions, newPos];
    savePositions(nextPos);

    setNewPosName('');
    setNewPosDesc('');
    setShowPositionForm(false);
    setSuccessMsg(`Nueva posición "${newPos.name}" registrada de alta de forma exitosa bajo la jerarquía de "${newPos.hierarchy}".`);
    setTimeout(() => setSuccessMsg(''), 6000);
  };

  // Delete custom position
  const handleDeletePosition = (pos: WmsPosition) => {
    setErrorMsg('');
    if (!clearance.canManageCrew) {
      alert('Error: No posee jerarquía suficiente para eliminar posiciones.');
      return;
    }

    // Protect core default positions
    const coreIds = ['pos-1', 'pos-2', 'pos-3', 'pos-4', 'pos-5'];
    if (coreIds.includes(pos.id)) {
      alert('No es posible eliminar posiciones maestras por defecto del WMS.');
      return;
    }

    // Check if any crew member is currently assigned to this position
    const inUse = crewList.some(c => c.role.toLowerCase() === pos.name.toLowerCase());
    if (inUse) {
      alert(`No se puede eliminar la posición "${pos.name}" porque está asignada a uno o más miembros activos del equipo.`);
      return;
    }

    const confirmed = window.confirm(`¿Está seguro de que desea eliminar permanentemente la posición "${pos.name}"?`);
    if (!confirmed) return;

    const nextPos = positions.filter(p => p.id !== pos.id);
    savePositions(nextPos);

    setSuccessMsg(`Posición de trabajo "${pos.name}" eliminada de los catálogos operacionales.`);
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  const currentDetailedMember = crewList.find(c => c.id === detailedMemberId);

  return (
    <div className="space-y-6">
      
      {/* Banner de Cabecera con Nivel de Autorización */}
      <div className="bg-slate-900 border border-slate-800 text-white p-6 rounded-2xl shadow-md">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400">
                <UserCheck className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-extrabold tracking-widest uppercase font-mono text-slate-300">
                Registro de Personal & Control de Jerarquías
              </h2>
            </div>
            <p className="text-xs text-slate-400 max-w-xl">
              Administre el equipo operacional del almacén, configure nuevas posiciones personalizadas, y suspenda o dé de baja personal regulando su nivel de permisos para modificar el sistema.
            </p>
          </div>
          
          {/* Badge de Jerarquía de Sesión Activa */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-3 shrink-0 self-stretch md:self-auto flex items-center justify-between gap-3">
            <div className="space-y-0.5 text-left">
              <span className="text-[9px] uppercase font-bold text-slate-500 font-mono tracking-wider block">Sesión Activa</span>
              <span className="text-xs font-black text-slate-200 block truncate max-w-[170px]">{clearance.label}</span>
            </div>
            <div className={`px-2.5 py-1 rounded-lg text-[9px] font-mono font-black uppercase flex items-center gap-1.5 ${
              clearance.hierarchy === 'Administrador' 
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                : clearance.hierarchy === 'Supervisor'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-slate-800 text-slate-300 border border-slate-700'
            }`}>
              <Shield className="h-3 w-3" />
              {clearance.hierarchy}
            </div>
          </div>
        </div>
      </div>

      {/* Alertas */}
      {successMsg && (
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-bold leading-relaxed shadow-3xs flex items-center gap-2">
          <Unlock className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs font-bold leading-relaxed shadow-3xs flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Sub-navegación: Personal vs Posiciones */}
      <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-250/60 shadow-3xs w-full md:w-fit">
        <button
          onClick={() => { setActiveSubTab('crew'); setErrorMsg(''); }}
          className={`flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer select-none ${
            activeSubTab === 'crew'
              ? 'bg-white text-indigo-650 shadow-xs'
              : 'text-slate-600 hover:text-indigo-650 hover:bg-slate-50/50'
          }`}
        >
          <UserCheck className="h-4 w-4" />
          <span>Miembros del Equipo & Accesos</span>
        </button>
        <button
          onClick={() => { setActiveSubTab('positions'); setErrorMsg(''); }}
          className={`flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer select-none ${
            activeSubTab === 'positions'
              ? 'bg-white text-indigo-650 shadow-xs'
              : 'text-slate-600 hover:text-indigo-650 hover:bg-slate-50/50'
          }`}
        >
          <Briefcase className="h-4 w-4" />
          <span>Catálogo de Posiciones (Dar de Alta)</span>
        </button>
      </div>

      {/* 1. SECCIÓN DE GESTIÓN DE PERSONAL */}
      {activeSubTab === 'crew' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Lado Izquierdo (col-span-5): Cambio de sesión activa */}
          <div className="lg:col-span-5 space-y-6">
            
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                <div>
                  <h3 className="text-xs font-bold font-mono text-slate-800 uppercase tracking-tight">Cambio Rápido de Sesión</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Inicie sesión rápido en un terminal simulado de bodega con su PIN.</p>
                </div>
                {activeOperator ? (
                  <span className="text-[9px] font-mono font-bold bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                    <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-ping" />
                    Ingresado
                  </span>
                ) : (
                  <span className="text-[9px] font-mono font-bold bg-slate-100 border border-slate-250 text-slate-500 px-2 py-0.5 rounded-lg">
                    Admin Central
                  </span>
                )}
              </div>

              {activeOperator ? (
                /* OPERATOR CURRENTLY LOGGED IN */
                <div className="bg-slate-50 border border-slate-200 p-4.5 rounded-2xl space-y-4">
                  <div className="flex gap-4">
                    <div className="h-12 w-12 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-600 font-black text-sm uppercase shrink-0">
                      {activeOperator.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-black text-slate-800 leading-snug truncate">{activeOperator.name}</h4>
                      <p className="text-[10px] text-slate-400 leading-none mt-0.5 truncate font-semibold">{activeOperator.email}</p>
                      
                      <div className="flex gap-1.5 mt-2">
                        <span className="inline-block text-[9px] font-mono font-bold bg-indigo-100 text-indigo-800 border border-indigo-150 px-2 py-0.5 rounded-md uppercase">
                           {activeOperator.role}
                        </span>
                        <span className="inline-block text-[9px] font-mono font-black bg-slate-900 text-white px-2 py-0.5 rounded-md uppercase">
                           {activeOperator.hierarchy}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-[10px] space-y-2 border-t border-slate-200 pt-3.5 text-slate-500 font-semibold">
                    <div className="flex justify-between">
                      <span>ID Operario:</span>
                      <span className="font-mono font-bold text-slate-800">{activeOperator.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Lector Zebra:</span>
                      <span className="font-mono font-bold text-slate-800">{activeOperator.deviceId}</span>
                    </div>
                    {activeOperator.contactNumber && (
                      <div className="flex justify-between">
                        <span>Contacto:</span>
                        <span className="font-mono font-bold text-slate-800">{activeOperator.contactNumber}</span>
                      </div>
                    )}
                    {activeOperator.department && (
                      <div className="flex justify-between">
                        <span>Departamento:</span>
                        <span className="font-mono font-bold text-slate-800">{activeOperator.department}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 border-t border-slate-200 pt-3">
                    <button
                      onClick={() => handleStartEdit(activeOperator)}
                      className="flex-1 bg-white hover:bg-slate-50 border border-slate-250 text-slate-700 font-bold py-2 px-3 rounded-xl text-[10px] uppercase tracking-wider shadow-3xs transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Edit className="h-3.5 w-3.5" />
                      Mi Perfil
                    </button>
                    <button
                      onClick={handleLogoutOperator}
                      className="flex-1 bg-rose-50 hover:bg-rose-100 border border-rose-150 text-rose-700 font-bold py-2 px-3 rounded-xl text-[10px] uppercase tracking-wider shadow-3xs transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <X className="h-3.5 w-3.5" />
                      Salir
                    </button>
                  </div>
                </div>
              ) : (
                /* NO ACTIVE OPERATOR (DEFAULT ADMIN ACCESS) */
                <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 tracking-wider">Seleccionar Miembro</label>
                    <select
                      value={selectedProfileId}
                      onChange={(e) => {
                        setSelectedProfileId(e.target.value);
                        setLoginError('');
                      }}
                      className="w-full text-xs rounded-xl border border-slate-250 p-2.5 text-slate-700 bg-white font-semibold focus:border-indigo-500"
                      required
                    >
                      <option value="">-- Escoger Personal --</option>
                      {crewList.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.name} [{item.role}] - {item.status === 'Inactivo' ? '🔴 Sancionado' : '🟢 Activo'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 tracking-wider">PIN de Seguridad (4 dígitos)</label>
                    <div className="relative flex items-center">
                      <Key className="absolute left-3.5 h-4 w-4 text-slate-400" />
                      <input
                        type="password"
                        maxLength={4}
                        value={inputPin}
                        onChange={(e) => setInputPin(e.target.value)}
                        placeholder="Introduzca el código PIN (ej. 1234)"
                        className="w-full pl-10 pr-3 py-2.5 font-mono font-bold border border-slate-250 rounded-xl focus:border-indigo-500 text-center tracking-widest focus:outline-none"
                        required
                      />
                    </div>
                  </div>

                  {loginError && (
                    <div className="p-3 rounded-xl border border-rose-100 bg-rose-50 text-rose-700 font-bold text-[11px] leading-relaxed flex items-center gap-1.5">
                      <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                      <span>{loginError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl text-[10px] uppercase tracking-wider shadow flex items-center justify-center gap-2 cursor-pointer transition"
                  >
                    <LogIn className="h-4 w-4" />
                    Conectar Operador en Terminal
                  </button>
                </form>
              )}

            </div>

            {/* REGISTER OR EDIT FORM PANEL */}
            {showRegisterForm && clearance.canManageCrew && (
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="border-b border-slate-150 pb-2.5 flex justify-between items-center">
                  <div>
                    <h3 className="text-xs font-bold text-indigo-950 uppercase">Formulario de Alta Crew</h3>
                    <p className="text-[9px] text-slate-400 mt-0.5">Registre un nuevo miembro y defina su posición.</p>
                  </div>
                  <button onClick={() => setShowRegisterForm(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <form onSubmit={handleRegister} className="space-y-3.5 text-xs">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Nombre Completo</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Carlos Villagrán"
                      className="w-full rounded-xl border border-slate-200 p-2 focus:border-indigo-500 focus:outline-none font-bold"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Correo Electrónico</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. carlos.v@warehouse.com"
                      className="w-full rounded-xl border border-slate-200 p-2 focus:border-indigo-500 focus:outline-none"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Posición de Trabajo</label>
                      <select
                        value={selectedRoleName}
                        onChange={(e) => setSelectedRoleName(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 p-2 text-slate-700 bg-white font-semibold focus:outline-none"
                      >
                        {positions.map(pos => (
                          <option key={pos.id} value={pos.name}>
                            {pos.name}
                          </option>
                        ))}
                      </select>
                    </div>

                     <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                        {platformRole === 'Administrador General' ? 'PIN Acceso (4 dgt)' : 'PIN Acceso (Oculto para Supervisor)'}
                      </label>
                      <div className="relative">
                        <input
                          type={(platformRole === 'Administrador General' && showRegisterPin) ? "text" : "password"}
                          maxLength={4}
                          value={pin}
                          onChange={(e) => setPin(e.target.value)}
                          placeholder="5555"
                          className="w-full font-mono text-center font-bold rounded-xl border border-slate-200 p-2 focus:border-indigo-500 focus:outline-none pr-10"
                          required
                        />
                        {platformRole === 'Administrador General' && (
                          <button
                            type="button"
                            onClick={() => setShowRegisterPin(!showRegisterPin)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-650 transition cursor-pointer"
                          >
                            {showRegisterPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Terminal de Mano / Zebra Scanner</label>
                    <input
                      type="text"
                      value={deviceId}
                      onChange={(e) => setDeviceId(e.target.value)}
                      placeholder="ZEBRA-TC21-02"
                      className="w-full font-mono rounded-xl border border-slate-200 p-2 focus:border-indigo-500 focus:outline-none"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Número de Contacto</label>
                      <input
                        type="text"
                        value={contactNumber}
                        onChange={(e) => setContactNumber(e.target.value)}
                        placeholder="+34 600 112 233"
                        className="w-full rounded-xl border border-slate-200 p-2 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Departamento WMS</label>
                      <input
                        type="text"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        placeholder="Recepción"
                        className="w-full rounded-xl border border-slate-200 p-2 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl text-[10px] uppercase tracking-wider transition cursor-pointer shadow flex items-center justify-center gap-1.5"
                  >
                    <Plus className="h-4 w-4" />
                    Completar Registro de Alta
                  </button>
                </form>
              </div>
            )}

            {isEditingProfile && (
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="border-b border-slate-150 pb-2 flex justify-between items-center text-slate-700">
                  <span className="text-xs font-black uppercase flex items-center gap-1">
                    <Edit className="h-3.5 w-3.5 text-blue-500" />
                    Editar Perfil
                  </span>
                  <button onClick={() => setIsEditingProfile(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <form onSubmit={handleSaveProfile} className="space-y-3.5 text-xs">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Nombre Completo</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 p-2 text-slate-700 bg-white focus:border-indigo-500 focus:outline-none font-bold"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Correo Electrónico</label>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 p-2 text-slate-700 bg-white focus:border-indigo-500 focus:outline-none"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Posición de Trabajo</label>
                      <select
                        value={editRoleName}
                        onChange={(e) => setEditRoleName(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 p-2 text-slate-700 bg-white focus:border-indigo-500 focus:outline-none font-semibold"
                      >
                        {positions.map(pos => (
                          <option key={pos.id} value={pos.name}>
                            {pos.name}
                          </option>
                        ))}
                      </select>
                    </div>

                     <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                        {platformRole === 'Administrador General' ? 'PIN Acceso (4 dgt)' : 'PIN Acceso (Oculto para Supervisor)'}
                      </label>
                      <div className="relative">
                        <input
                          type={(platformRole === 'Administrador General' && showEditPin) ? "text" : "password"}
                          maxLength={4}
                          value={editPin}
                          onChange={(e) => setEditPin(e.target.value)}
                          className="w-full font-mono text-center font-bold rounded-xl border border-slate-200 p-2 text-slate-700 bg-white focus:border-indigo-500 focus:outline-none pr-10"
                          required
                        />
                        {platformRole === 'Administrador General' && (
                          <button
                            type="button"
                            onClick={() => setShowEditPin(!showEditPin)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-650 transition cursor-pointer"
                          >
                            {showEditPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Dispositivo Escáner / Terminal</label>
                    <input
                      type="text"
                      value={editDeviceId}
                      onChange={(e) => setEditDeviceId(e.target.value)}
                      className="w-full font-mono rounded-xl border border-slate-200 p-2 text-slate-700 bg-white focus:border-indigo-500"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Contacto</label>
                      <input
                        type="text"
                        value={editContactNumber}
                        onChange={(e) => setEditContactNumber(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 p-2 text-slate-700 bg-white focus:border-indigo-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Departamento</label>
                      <input
                        type="text"
                        value={editDepartment}
                        onChange={(e) => setEditDepartment(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 p-2 text-slate-700 bg-white focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 border-t border-slate-150 pt-3">
                    <button
                      type="submit"
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-xl text-[10px] uppercase tracking-wider shadow-3xs flex items-center justify-center gap-1.5 transition"
                    >
                      <Save className="h-3.5 w-3.5" />
                      Guardar
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingProfile(false)}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2 rounded-xl text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            )}

          </div>

          {/* Lado Derecho (col-span-7): Directorio y Control de Miembros */}
          <div className="lg:col-span-7 space-y-4">
            
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="border-b border-slate-100 pb-3 flex justify-between items-center text-slate-800">
                <span className="text-xs font-bold font-mono uppercase">Directorio del Equipo Logístico</span>
                
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-slate-100 border border-slate-200 text-slate-500 px-2 py-0.5 rounded font-mono font-bold">
                    {crewList.length} Miembros
                  </span>
                  {clearance.canManageCrew && !isReadOnly && (
                    <button
                      onClick={() => { setShowRegisterForm(true); setShowPositionForm(false); }}
                      className="text-[9px] font-black bg-indigo-600 text-white border border-transparent hover:bg-indigo-700 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1"
                    >
                      <UserPlus className="h-3 w-3" />
                      Dar de Alta Personal
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[460px] overflow-y-auto pr-1">
                {crewList.map(member => {
                  const initials = member.name.split(' ').map(n => n[0]).join('').substring(0, 2);
                  const isSuspended = member.status === 'Inactivo';
                  const isSelected = detailedMemberId === member.id;

                  return (
                    <div
                      key={member.id}
                      onClick={() => setDetailedMemberId(member.id)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer text-left flex flex-col justify-between gap-3 ${
                        isSelected 
                          ? 'border-indigo-600 bg-indigo-50/10 shadow-3xs' 
                          : 'border-slate-150 hover:border-slate-300 hover:bg-slate-50/30'
                      } ${isSuspended ? 'opacity-70 bg-slate-50/50' : ''}`}
                    >
                      <div className="flex gap-3 items-start justify-between">
                        <div className="flex gap-2.5 items-center min-w-0">
                          <div className={`h-8.5 w-8.5 rounded-full border flex items-center justify-center text-xs font-black uppercase shrink-0 ${
                            isSuspended 
                              ? 'bg-rose-50 border-rose-200 text-rose-600'
                              : member.hierarchy === 'Administrador'
                                ? 'bg-rose-100 border-rose-200 text-rose-700'
                                : member.hierarchy === 'Supervisor'
                                  ? 'bg-amber-100 border-amber-200 text-amber-700'
                                  : 'bg-indigo-100 border-indigo-200 text-indigo-700'
                          }`}>
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <span className="font-black text-slate-800 text-xs block truncate leading-tight">{member.name}</span>
                            <span className="text-[9px] text-slate-400 font-mono block mt-0.5 leading-none font-bold">Cod: {member.id}</span>
                          </div>
                        </div>

                        {/* Status badge */}
                        <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider ${
                          isSuspended 
                            ? 'bg-rose-100 text-rose-700 border border-rose-200' 
                            : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        }`}>
                          {member.status}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        <span className="text-[8.5px] font-sans font-black bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md">
                          {member.role}
                        </span>
                        <span className="text-[8.5px] font-mono text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                          {member.hierarchy}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* DETAILED MEMBER CARD WITH HIERARCHICAL MANAGEMENT CONTROLS */}
            {currentDetailedMember && (
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 animate-fadeIn">
                <div className="border-b border-slate-100 pb-2.5 flex justify-between items-center text-slate-800">
                  <div className="flex items-center gap-1.5">
                    <Shield className="h-4 w-4 text-indigo-650" />
                    <h3 className="text-xs font-extrabold uppercase font-mono tracking-tight">Expediente de Personal & Controles</h3>
                  </div>
                  <button onClick={() => setDetailedMemberId('')} className="text-slate-400 hover:text-slate-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                  
                  {/* Photo & core identifiers */}
                  <div className="md:col-span-4 text-center space-y-2 border-r border-slate-100 pr-2">
                    <div className={`h-16 w-16 rounded-full mx-auto border flex items-center justify-center text-lg font-black uppercase shadow-3xs ${
                      currentDetailedMember.status === 'Inactivo'
                        ? 'bg-rose-50 border-rose-200 text-rose-600'
                        : currentDetailedMember.hierarchy === 'Administrador'
                          ? 'bg-rose-100 border-rose-200 text-rose-700'
                          : currentDetailedMember.hierarchy === 'Supervisor'
                            ? 'bg-amber-100 border-amber-200 text-amber-700'
                            : 'bg-indigo-100 border-indigo-200 text-indigo-700'
                    }`}>
                      {currentDetailedMember.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-800">{currentDetailedMember.name}</h4>
                      <p className="text-[9px] font-mono text-slate-400 mt-0.5">WMS Cod: {currentDetailedMember.id}</p>
                    </div>

                    <div className="pt-2">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                        currentDetailedMember.status === 'Inactivo'
                          ? 'bg-rose-500/10 text-rose-700 border border-rose-200'
                          : 'bg-emerald-500/10 text-emerald-700 border border-emerald-200'
                      }`}>
                        {currentDetailedMember.status === 'Inactivo' ? '🔴 Acceso Revocado' : '🟢 Acceso Concedido'}
                      </span>
                    </div>
                  </div>

                  {/* Metadata list */}
                  <div className="md:col-span-8 space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-[10px] font-semibold text-slate-500 leading-tight">
                      <div className="bg-slate-50 p-2 rounded-xl border border-slate-150">
                        <span className="text-[8px] uppercase font-bold text-slate-400 block mb-0.5">Correo Corporativo</span>
                        <span className="text-slate-800 font-bold truncate block">{currentDetailedMember.email}</span>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-xl border border-slate-150">
                        <span className="text-[8px] uppercase font-bold text-slate-400 block mb-0.5">Posición</span>
                        <span className="text-slate-800 font-extrabold block truncate">{currentDetailedMember.role}</span>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-xl border border-slate-150">
                        <span className="text-[8px] uppercase font-bold text-slate-400 block mb-0.5">Jerarquía</span>
                        <span className="text-slate-800 font-mono font-black block">{currentDetailedMember.hierarchy}</span>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-xl border border-slate-150">
                        <span className="text-[8px] uppercase font-bold text-slate-400 block mb-0.5">Terminal / Lector</span>
                        <span className="text-slate-800 font-mono font-bold block">{currentDetailedMember.deviceId}</span>
                      </div>
                      <div className="bg-indigo-50/45 p-2 rounded-xl border border-indigo-150 col-span-2">
                        <span className="text-[8px] uppercase font-black text-indigo-500 block mb-0.5">Contraseña (PIN de Acceso)</span>
                        {platformRole === 'Administrador General' ? (
                          <div className="flex items-center gap-1.5 text-indigo-700 font-mono font-black text-xs">
                            <span className="tracking-wider">{currentDetailedMember.pin}</span>
                            <span className="text-[7.5px] uppercase px-1 py-0.5 rounded bg-indigo-100 border border-indigo-200 text-indigo-700 font-sans font-black">Visible para Admin</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-slate-400 font-mono text-xs">
                            <span className="tracking-widest">••••</span>
                            <span className="text-[7.5px] uppercase px-1 py-0.5 rounded bg-amber-50 border border-amber-150 text-amber-700 font-sans font-extrabold">Oculto para Supervisor</span>
                          </div>
                        )}
                      </div>
                      {currentDetailedMember.contactNumber && (
                        <div className="bg-slate-50 p-2 rounded-xl border border-slate-150">
                          <span className="text-[8px] uppercase font-bold text-slate-400 block mb-0.5">Teléfono</span>
                          <span className="text-slate-800 font-bold block">{currentDetailedMember.contactNumber}</span>
                        </div>
                      )}
                      {currentDetailedMember.department && (
                        <div className="bg-slate-50 p-2 rounded-xl border border-slate-150">
                          <span className="text-[8px] uppercase font-bold text-slate-400 block mb-0.5">Departamento</span>
                          <span className="text-slate-800 font-bold block truncate">{currentDetailedMember.department}</span>
                        </div>
                      )}
                    </div>

                     {/* HIERARCHICAL ACTION PANEL */}
                    <div className="border-t border-slate-100 pt-3 flex flex-wrap gap-2 justify-end">
                      
                      {/* Edit Profile Button (for managers or self) */}
                      {!isReadOnly && (activeOperator?.id === currentDetailedMember.id || (clearance.canManageCrew && canManageMember(currentDetailedMember))) && (
                        <button
                          onClick={() => handleStartEdit(currentDetailedMember)}
                          className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-250 text-slate-700 font-bold rounded-lg text-[9px] uppercase tracking-wider shadow-3xs cursor-pointer flex items-center gap-1"
                        >
                          <Edit className="h-3 w-3 text-indigo-600" />
                          Modificar Datos
                        </button>
                      )}

                      {/* Suspend / Revoke Access (Quitar acceso al sistema) */}
                      {!isReadOnly && clearance.canManageCrew && canManageMember(currentDetailedMember) && (
                        <button
                          onClick={() => handleToggleStatus(currentDetailedMember)}
                          className={`px-3 py-1.5 border font-bold rounded-lg text-[9px] uppercase tracking-wider shadow-3xs cursor-pointer flex items-center gap-1 transition ${
                            currentDetailedMember.status === 'Inactivo'
                              ? 'bg-emerald-50 border-emerald-250 text-emerald-700 hover:bg-emerald-100'
                              : 'bg-amber-50 border-amber-250 text-amber-700 hover:bg-amber-100'
                          }`}
                        >
                          {currentDetailedMember.status === 'Inactivo' ? (
                            <>
                              <Unlock className="h-3 w-3 text-emerald-600" />
                              Habilitar Acceso
                            </>
                          ) : (
                            <>
                              <Lock className="h-3 w-3 text-amber-600" />
                              Suspender Acceso
                            </>
                          )}
                        </button>
                      )}

                      {/* Terminate Personnel (Dar de baja personal definitivo) */}
                      {!isReadOnly && clearance.canManageCrew && canManageMember(currentDetailedMember) && (
                        <button
                          onClick={() => handleDeleteMember(currentDetailedMember)}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-150 text-rose-700 font-bold rounded-lg text-[9px] uppercase tracking-wider shadow-3xs cursor-pointer flex items-center gap-1 transition"
                        >
                          <Trash2 className="h-3 w-3 text-rose-600" />
                          Dar de Baja
                        </button>
                      )}

                    </div>
                  </div>

                </div>
              </div>
            )}

          </div>

        </div>
      )}

      {/* 2. SECCIÓN DE GESTIÓN DE POSICIONES Y JERARQUÍAS (DAR DE ALTA POSICIONES) */}
      {activeSubTab === 'positions' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
          
          {/* Lado Izquierdo (col-span-5): Registro de Nueva Posición */}
          <div className="lg:col-span-5">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="border-b border-slate-100 pb-2.5 flex justify-between items-center text-slate-800">
                <div>
                  <h3 className="text-xs font-bold font-mono uppercase">Alta de Nueva Posición</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Registre nuevos perfiles y asigne su nivel jerárquico.</p>
                </div>
                <Briefcase className="h-4.5 w-4.5 text-indigo-650" />
              </div>

              {clearance.canManageCrew && !isReadOnly ? (
                <form onSubmit={handleAddPosition} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Nombre de la Posición</label>
                    <input
                      type="text"
                      value={newPosName}
                      onChange={(e) => setNewPosName(e.target.value)}
                      placeholder="e.g. Jefe de Almacén, Operario de Maquila"
                      className="w-full text-xs rounded-xl border border-slate-250 p-2.5 text-slate-700 bg-white font-bold focus:border-indigo-500 focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Nivel de Jerarquía (Permisos)</label>
                    <select
                      value={newPosHierarchy}
                      onChange={(e) => setNewPosHierarchy(e.target.value as any)}
                      className="w-full text-xs rounded-xl border border-slate-250 p-2.5 text-slate-700 bg-white font-semibold focus:outline-none"
                    >
                      <option value="Operario">Operario (Solo lectura de catálogos, operaciones básicas)</option>
                      <option value="Supervisor">Supervisor (Gestión de inventario y personal operativo)</option>
                      <option value="Administrador">Administrador (Acceso ilimitado, control técnico, bajas)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Descripción de Funciones (Opcional)</label>
                    <textarea
                      value={newPosDesc}
                      onChange={(e) => setNewPosDesc(e.target.value)}
                      placeholder="Indique las responsabilidades de esta nueva posición..."
                      className="w-full text-xs rounded-xl border border-slate-250 p-2.5 text-slate-700 bg-white focus:outline-none h-20 resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-[10px] uppercase tracking-wider shadow flex items-center justify-center gap-1.5 cursor-pointer transition"
                  >
                    <Plus className="h-4 w-4" />
                    Registrar Alta de Posición
                  </button>
                </form>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center space-y-2">
                  <Lock className="h-8 w-8 text-slate-400 mx-auto" />
                  <p className="text-xs text-slate-500 font-bold leading-relaxed">
                    Acceso Restringido: Se requieren permisos de Supervisor o Administrador para crear nuevas posiciones.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Lado Derecho (col-span-7): Catálogo de Posiciones Existentes */}
          <div className="lg:col-span-7">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="border-b border-slate-100 pb-3 text-slate-800">
                <h3 className="text-xs font-bold font-mono uppercase">Posiciones y Roles Registrados</h3>
                <p className="text-[10px] text-slate-400 mt-0.5 font-semibold">Toda posición creada regula el nivel de permisos que se asigna automáticamente al operador.</p>
              </div>

              <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1 text-xs">
                {positions.map(pos => {
                  const isCore = ['pos-1', 'pos-2', 'pos-3', 'pos-4', 'pos-5'].includes(pos.id);
                  const inUse = crewList.some(c => c.role.toLowerCase() === pos.name.toLowerCase());

                  return (
                    <div 
                      key={pos.id}
                      className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-extrabold text-slate-800 text-xs block">{pos.name}</span>
                          
                          <span className={`px-2 py-0.5 rounded text-[8.5px] font-mono font-black uppercase tracking-wider ${
                            pos.hierarchy === 'Administrador'
                              ? 'bg-rose-100 text-rose-700 border border-rose-200'
                              : pos.hierarchy === 'Supervisor'
                                ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                : 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                          }`}>
                            {pos.hierarchy}
                          </span>

                          {isCore && (
                            <span className="text-[8.5px] font-sans font-bold text-slate-400 bg-slate-200/60 px-1.5 py-0.5 rounded">
                              Maestra
                            </span>
                          )}
                        </div>
                        {pos.description && (
                          <p className="text-[10.5px] text-slate-400 font-medium leading-relaxed max-w-md">
                            {pos.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <span className={`text-[8.5px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                          inUse 
                            ? 'bg-blue-50 border-blue-150 text-blue-600' 
                            : 'bg-slate-100 border-slate-200 text-slate-400'
                        }`}>
                          {inUse ? 'En Uso' : 'Inactivo'}
                        </span>

                        {!isCore && clearance.canManageCrew && !isReadOnly && (
                          <button
                            onClick={() => handleDeletePosition(pos)}
                            disabled={inUse}
                            className={`p-1.5 rounded-lg border transition ${
                              inUse 
                                ? 'bg-slate-100 border-slate-150 text-slate-300 cursor-not-allowed' 
                                : 'bg-white hover:bg-rose-50 border-slate-250 text-slate-500 hover:text-rose-600 cursor-pointer shadow-3xs'
                            }`}
                            title={inUse ? 'No se puede eliminar porque tiene personal asignado' : 'Eliminar posición'}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
