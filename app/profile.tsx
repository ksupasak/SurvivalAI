import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/theme';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

interface EmergencyContact {
  name: string;
  phone: string;
}

export default function ProfileScreen() {
  const router = useRouter();

  // Personal Information
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [bloodType, setBloodType] = useState('');
  const [nationality, setNationality] = useState('');
  const [languages, setLanguages] = useState('');

  // Medical Information
  const [medicalConditions, setMedicalConditions] = useState('');
  const [allergies, setAllergies] = useState('');
  const [medications, setMedications] = useState('');
  const [specialNeeds, setSpecialNeeds] = useState('');

  // Emergency Contacts
  const [contacts, setContacts] = useState<EmergencyContact[]>([
    { name: '', phone: '' },
    { name: '', phone: '' },
  ]);

  // Insurance / ID
  const [insuranceProvider, setInsuranceProvider] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [idNumber, setIdNumber] = useState('');

  const updateContact = (index: number, field: 'name' | 'phone', value: string) => {
    setContacts((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addContact = () => {
    if (contacts.length >= 4) {
      Alert.alert('Limit Reached', 'Maximum of 4 emergency contacts allowed.');
      return;
    }
    setContacts((prev) => [...prev, { name: '', phone: '' }]);
  };

  const handleSave = () => {
    Alert.alert('Profile Saved', 'Your profile has been saved locally to this device.', [
      { text: 'OK' },
    ]);
  };

  const handleSendMorse = () => {
    const parts: string[] = [];
    if (fullName) parts.push(fullName.toUpperCase());
    if (bloodType) parts.push(`BT:${bloodType}`);
    if (medicalConditions) parts.push(`MED:${medicalConditions.slice(0, 30).toUpperCase()}`);
    if (allergies) parts.push(`ALG:${allergies.slice(0, 30).toUpperCase()}`);

    const encoded = parts.length > 0 ? parts.join(' | ') : 'No profile data to encode.';

    Alert.alert('Morse Code Encoding', `The following would be encoded as Morse:\n\n${encoded}`, [
      { text: 'OK' },
    ]);
  };

  const handlePreviewBLE = () => {
    const data: Record<string, string> = {};
    if (fullName) data['Name'] = fullName;
    if (bloodType) data['Blood Type'] = bloodType;
    if (medicalConditions) data['Conditions'] = medicalConditions;
    if (allergies) data['Allergies'] = allergies;
    if (medications) data['Medications'] = medications;
    if (specialNeeds) data['Special Needs'] = specialNeeds;
    if (contacts[0]?.name) data['Emergency Contact'] = `${contacts[0].name} ${contacts[0].phone}`;

    const preview =
      Object.keys(data).length > 0
        ? Object.entries(data)
            .map(([k, v]) => `${k}: ${v}`)
            .join('\n')
        : 'No profile data to broadcast.';

    Alert.alert('BLE Broadcast Preview', `Data that would be included in beacon:\n\n${preview}`, [
      { text: 'OK' },
    ]);
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear All Data',
      'Are you sure you want to clear all profile data? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            setFullName('');
            setDateOfBirth('');
            setBloodType('');
            setNationality('');
            setLanguages('');
            setMedicalConditions('');
            setAllergies('');
            setMedications('');
            setSpecialNeeds('');
            setContacts([
              { name: '', phone: '' },
              { name: '', phone: '' },
            ]);
            setInsuranceProvider('');
            setPolicyNumber('');
            setIdNumber('');
          },
        },
      ]
    );
  };

  // Build compact emergency card summary
  const compactParts: string[] = [];
  if (fullName) compactParts.push(fullName.toUpperCase());
  if (bloodType) compactParts.push(bloodType);
  if (medicalConditions) compactParts.push(medicalConditions.split(',')[0].trim().toUpperCase());
  if (allergies) compactParts.push(allergies.split(',')[0].trim().toUpperCase());
  const compactSummary =
    compactParts.length > 0 ? compactParts.join(' | ') : 'No data entered yet';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={Colors.text} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleRow}>
            <Ionicons name="person" size={24} color={Colors.amber} />
            <Text style={styles.headerTitle}>PERSONAL PROFILE</Text>
          </View>
          <Text style={styles.headerSubtitle}>Medical & Emergency Information</Text>
          <Text style={styles.headerInfo}>
            This information is shared with rescuers via BLE beacon and can be encoded as Morse
            code signals
          </Text>
        </View>

        {/* Personal Information */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="person-outline" size={18} color={Colors.amber} />
            <Text style={styles.cardTitle}>PERSONAL INFORMATION</Text>
          </View>

          <Text style={styles.inputLabel}>Full Name</Text>
          <TextInput
            style={styles.textInput}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Enter your full name"
            placeholderTextColor={Colors.textDim}
          />

          <Text style={styles.inputLabel}>Date of Birth</Text>
          <TextInput
            style={styles.textInput}
            value={dateOfBirth}
            onChangeText={setDateOfBirth}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={Colors.textDim}
          />

          <Text style={styles.inputLabel}>Blood Type</Text>
          <View style={styles.bloodTypeGrid}>
            {BLOOD_TYPES.map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.bloodTypeButton,
                  bloodType === type && styles.bloodTypeButtonSelected,
                ]}
                onPress={() => setBloodType(bloodType === type ? '' : type)}
              >
                <Text
                  style={[
                    styles.bloodTypeText,
                    bloodType === type && styles.bloodTypeTextSelected,
                  ]}
                >
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.inputLabel}>Nationality</Text>
          <TextInput
            style={styles.textInput}
            value={nationality}
            onChangeText={setNationality}
            placeholder="Enter your nationality"
            placeholderTextColor={Colors.textDim}
          />

          <Text style={styles.inputLabel}>Language(s)</Text>
          <TextInput
            style={styles.textInput}
            value={languages}
            onChangeText={setLanguages}
            placeholder="e.g., English, Spanish"
            placeholderTextColor={Colors.textDim}
          />
        </View>

        {/* Medical Information */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="medkit-outline" size={18} color={Colors.red} />
            <Text style={styles.cardTitle}>MEDICAL INFORMATION</Text>
          </View>

          <Text style={styles.inputLabel}>Medical Conditions</Text>
          <TextInput
            style={[styles.textInput, styles.textInputMultiline]}
            value={medicalConditions}
            onChangeText={setMedicalConditions}
            placeholder="e.g., Diabetes Type 2, Asthma"
            placeholderTextColor={Colors.textDim}
            multiline
            numberOfLines={3}
          />

          <Text style={styles.inputLabel}>Allergies</Text>
          <TextInput
            style={[styles.textInput, styles.textInputMultiline]}
            value={allergies}
            onChangeText={setAllergies}
            placeholder="e.g., Penicillin, Peanuts"
            placeholderTextColor={Colors.textDim}
            multiline
            numberOfLines={3}
          />

          <Text style={styles.inputLabel}>Current Medications</Text>
          <TextInput
            style={[styles.textInput, styles.textInputMultiline]}
            value={medications}
            onChangeText={setMedications}
            placeholder="e.g., Metformin 500mg twice daily"
            placeholderTextColor={Colors.textDim}
            multiline
            numberOfLines={3}
          />

          <Text style={styles.inputLabel}>Special Needs</Text>
          <TextInput
            style={[styles.textInput, styles.textInputMultiline]}
            value={specialNeeds}
            onChangeText={setSpecialNeeds}
            placeholder="e.g., Wheelchair user, requires insulin"
            placeholderTextColor={Colors.textDim}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Emergency Contacts */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="call-outline" size={18} color={Colors.cyan} />
            <Text style={styles.cardTitle}>EMERGENCY CONTACTS</Text>
          </View>

          {contacts.map((contact, index) => (
            <View key={index} style={styles.contactGroup}>
              <Text style={styles.contactLabel}>Contact {index + 1}</Text>
              <TextInput
                style={styles.textInput}
                value={contact.name}
                onChangeText={(val) => updateContact(index, 'name', val)}
                placeholder="Contact name"
                placeholderTextColor={Colors.textDim}
              />
              <TextInput
                style={styles.textInput}
                value={contact.phone}
                onChangeText={(val) => updateContact(index, 'phone', val)}
                placeholder="Phone number"
                placeholderTextColor={Colors.textDim}
                keyboardType="phone-pad"
              />
            </View>
          ))}

          {contacts.length < 4 && (
            <TouchableOpacity style={styles.addContactButton} onPress={addContact}>
              <Ionicons name="add-circle-outline" size={20} color={Colors.cyan} />
              <Text style={styles.addContactText}>Add Contact</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Insurance / ID */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="card-outline" size={18} color={Colors.blue} />
            <Text style={styles.cardTitle}>INSURANCE / ID</Text>
          </View>

          <Text style={styles.inputLabel}>Insurance Provider</Text>
          <TextInput
            style={styles.textInput}
            value={insuranceProvider}
            onChangeText={setInsuranceProvider}
            placeholder="Enter insurance provider"
            placeholderTextColor={Colors.textDim}
          />

          <Text style={styles.inputLabel}>Policy Number</Text>
          <TextInput
            style={styles.textInput}
            value={policyNumber}
            onChangeText={setPolicyNumber}
            placeholder="Enter policy number"
            placeholderTextColor={Colors.textDim}
          />

          <Text style={styles.inputLabel}>ID / Passport Number</Text>
          <TextInput
            style={styles.textInput}
            value={idNumber}
            onChangeText={setIdNumber}
            placeholder="Enter ID or passport number"
            placeholderTextColor={Colors.textDim}
          />
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Ionicons name="save-outline" size={20} color={Colors.bg} />
            <Text style={styles.saveButtonText}>Save Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleSendMorse}>
            <Ionicons name="flashlight-outline" size={20} color={Colors.amber} />
            <Text style={styles.actionButtonText}>Send via Morse Code</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handlePreviewBLE}>
            <Ionicons name="radio-outline" size={20} color={Colors.cyan} />
            <Text style={[styles.actionButtonText, { color: Colors.cyan }]}>
              Preview BLE Broadcast Data
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.clearButton} onPress={handleClearAll}>
            <Ionicons name="trash-outline" size={20} color={Colors.red} />
            <Text style={styles.clearButtonText}>Clear All Data</Text>
          </TouchableOpacity>
        </View>

        {/* PDPA / Privacy Policy */}
        <View style={styles.pdpaCard}>
          <View style={styles.pdpaHeader}>
            <Ionicons name="shield-checkmark-outline" size={18} color={Colors.textSecondary} />
            <Text style={styles.pdpaTitle}>DATA PRIVACY</Text>
          </View>
          <Text style={styles.pdpaDesc}>
            Your personal data is stored locally on this device only and is never uploaded to any
            server. Data shared via BLE beacon or Morse code is transmitted only when you initiate
            it.
          </Text>
          <TouchableOpacity
            style={styles.pdpaLinkButton}
            onPress={() =>
              Linking.openURL('https://www.pdpa.gov.th/en/index')
            }
            activeOpacity={0.7}
          >
            <Ionicons name="open-outline" size={16} color={Colors.cyan} />
            <Text style={styles.pdpaLinkText}>PDPA Privacy Policy</Text>
          </TouchableOpacity>
        </View>

        {/* Compact Emergency Card */}
        <View style={styles.compactCard}>
          <View style={styles.compactCardHeader}>
            <Ionicons name="alert-circle" size={18} color={Colors.bg} />
            <Text style={styles.compactCardTitle}>EMERGENCY BROADCAST SUMMARY</Text>
          </View>
          <Text style={styles.compactCardInfo}>
            Transmitted via BLE beacon and Morse code
          </Text>
          <View style={styles.compactCardContent}>
            <Text style={styles.compactCardData}>{compactSummary}</Text>
          </View>
        </View>

        <View style={{ height: Spacing.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },

  // Header
  header: {
    marginBottom: Spacing.xxl,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: FontSize.lg,
    color: Colors.text,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  headerTitle: {
    fontSize: FontSize.xxxl,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: 2,
  },
  headerSubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  headerInfo: {
    fontSize: FontSize.sm,
    color: Colors.textDim,
    lineHeight: 18,
  },

  // Cards
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  cardTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.amber,
    letterSpacing: 1.5,
  },

  // Inputs
  inputLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
  },
  textInput: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
    fontSize: FontSize.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
  },
  textInputMultiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },

  // Blood type selector
  bloodTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  bloodTypeButton: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    minWidth: 60,
    alignItems: 'center',
  },
  bloodTypeButtonSelected: {
    backgroundColor: Colors.redDim,
    borderColor: Colors.red,
  },
  bloodTypeText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textDim,
  },
  bloodTypeTextSelected: {
    color: Colors.red,
  },

  // Emergency Contacts
  contactGroup: {
    marginBottom: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  contactLabel: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.cyan,
    letterSpacing: 1,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
  },
  addContactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  addContactText: {
    fontSize: FontSize.md,
    color: Colors.cyan,
    fontWeight: '600',
  },

  // Actions
  actionsContainer: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.green,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
  },
  saveButtonText: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.bg,
    letterSpacing: 1,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionButtonText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.amber,
    letterSpacing: 0.5,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.redDim,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.red,
  },
  clearButtonText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.red,
    letterSpacing: 0.5,
  },

  // PDPA / Privacy
  pdpaCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pdpaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  pdpaTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 1.5,
  },
  pdpaDesc: {
    fontSize: FontSize.sm,
    color: Colors.textDim,
    lineHeight: 18,
    marginBottom: Spacing.lg,
  },
  pdpaLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.cyan + '15',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  pdpaLinkText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.cyan,
    letterSpacing: 1,
  },

  // Compact Emergency Card
  compactCard: {
    backgroundColor: Colors.amber,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  compactCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  compactCardTitle: {
    fontSize: FontSize.sm,
    fontWeight: '800',
    color: Colors.bg,
    letterSpacing: 1.5,
  },
  compactCardInfo: {
    fontSize: FontSize.xs,
    color: Colors.bg,
    opacity: 0.7,
    marginBottom: Spacing.md,
  },
  compactCardContent: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  compactCardData: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.bg,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});
