import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Calendar } from 'react-native-calendars'
import { supabase } from '../lib/supabase'

type Frizer = {
  id: string
  ime: string
  prezime: string
}

export default function Booking() {
  const { uslugaId, naziv } = useLocalSearchParams()
  const [frizeri, setFrizeri] = useState<Frizer[]>([])
  const [selectedFrizer, setSelectedFrizer] = useState<string | null>(null)
  const [selectedDatum, setSelectedDatum] = useState<string | null>(null)
  const [selectedVreme, setSelectedVreme] = useState<string | null>(null)
  const [zauzetoVreme, setZauzetoVreme] = useState<string[]>([])
  const router = useRouter()

  const svaVremena = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00']
  const danas = new Date().toISOString().split('T')[0]

  useEffect(() => {
    async function fetchFrizeri() {
      const { data, error } = await supabase.from('frizeri').select('*')
      if (!error) setFrizeri(data)
    }
    fetchFrizeri()
  }, [])

  useEffect(() => {
    if (selectedFrizer && selectedDatum) {
      fetchZauzetoVreme()
    }
  }, [selectedFrizer, selectedDatum])

  async function fetchZauzetoVreme() {
    const odDatuma = `${selectedDatum}T00:00:00`
    const doDatuma = `${selectedDatum}T23:59:59`

    const { data, error } = await supabase
      .from('termini')
      .select('datum_vreme')
      .eq('frizer_id', selectedFrizer)
      .eq('status', 'aktivan')
      .gte('datum_vreme', odDatuma)
      .lte('datum_vreme', doDatuma)

    if (!error && data) {
      const zauzeto = data.map((t: any) => {
        const d = new Date(t.datum_vreme)
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      })
      setZauzetoVreme(zauzeto)
    }
  }

  async function handleBooking() {
    if (!selectedFrizer || !selectedDatum || !selectedVreme) {
      Alert.alert('Greška', 'Molimo odaberite frizera, datum i vreme')
      return
    }

    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase.from('termini').insert({
      korisnik_id: user?.id,
      frizer_id: selectedFrizer,
      usluga_id: uslugaId,
      datum_vreme: `${selectedDatum}T${selectedVreme}:00`,
      status: 'aktivan'
    })

    if (error) {
      Alert.alert('Greška', error.message)
    } else {
      Alert.alert('Uspeh!', 'Termin je zakazan!', [
        { text: 'OK', onPress: () => router.replace('/(tabs)') }
      ])
    }
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Zakaži: {naziv}</Text>

      {/* Odabir frizera */}
      <Text style={styles.sectionTitle}>Odaberi frizera</Text>
      <View style={styles.row}>
        {frizeri.map((f) => (
          <TouchableOpacity
            key={f.id}
            style={[styles.chip, selectedFrizer === f.id && styles.chipSelected]}
            onPress={() => {
              setSelectedFrizer(f.id)
              setSelectedVreme(null)
            }}
          >
            <Text style={[styles.chipText, selectedFrizer === f.id && styles.chipTextSelected]}>
              {f.ime} {f.prezime}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Kalendar */}
      <Text style={styles.sectionTitle}>Odaberi datum</Text>
      <Calendar
        minDate={danas}
        onDayPress={(day: any) => {
          setSelectedDatum(day.dateString)
          setSelectedVreme(null)
        }}
        markedDates={selectedDatum ? {
          [selectedDatum]: { selected: true, selectedColor: '#2D6A4F' }
        } : {}}
        theme={{
          todayTextColor: '#2D6A4F',
          arrowColor: '#2D6A4F',
        }}
      />

      {/* Odabir vremena */}
      {selectedFrizer && selectedDatum && (
        <>
          <Text style={styles.sectionTitle}>Odaberi vreme</Text>
          <View style={styles.row}>
            {svaVremena.map((v) => {
              const zauzeto = zauzetoVreme.includes(v)
              return (
                <TouchableOpacity
                  key={v}
                  disabled={zauzeto}
                  style={[
                    styles.chip,
                    selectedVreme === v && styles.chipSelected,
                    zauzeto && styles.chipDisabled,
                  ]}
                  onPress={() => setSelectedVreme(v)}
                >
                  <Text style={[
                    styles.chipText,
                    selectedVreme === v && styles.chipTextSelected,
                    zauzeto && styles.chipTextDisabled,
                  ]}>
                    {v}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </>
      )}

      <TouchableOpacity style={styles.bookButton} onPress={handleBooking}>
        <Text style={styles.bookButtonText}>Potvrdi rezervaciju</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10, marginTop: 15 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2D6A4F',
    backgroundColor: '#fff',
  },
  chipSelected: { backgroundColor: '#2D6A4F' },
  chipDisabled: { backgroundColor: '#e0e0e0', borderColor: '#ccc' },
  chipText: { color: '#2D6A4F', fontWeight: '500' },
  chipTextSelected: { color: '#fff' },
  chipTextDisabled: { color: '#aaa' },
  bookButton: {
    backgroundColor: '#2D6A4F',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 40,
  },
  bookButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
})