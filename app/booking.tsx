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

type Termin = {
  datum_vreme: string
  kraj_vreme: string
}

export default function Booking() {
  const { uslugaId, naziv, trajanje } = useLocalSearchParams()
  const [frizeri, setFrizeri] = useState<Frizer[]>([])
  const [selectedFrizer, setSelectedFrizer] = useState<string | null>(null)
  const [selectedDatum, setSelectedDatum] = useState<string | null>(null)
  const [selectedVreme, setSelectedVreme] = useState<string | null>(null)
  const [zauzetiTermini, setZauzetiTermini] = useState<Termin[]>([])
  const router = useRouter()

  const danas = new Date().toISOString().split('T')[0]
  const trajanjeMin = Number(trajanje) || 30

  // Generisi sve satnice po 15 min od 09:00 do 17:00
  function generisiSatnice() {
    const satnice = []
    for (let h = 9; h < 17; h++) {
      for (let m = 0; m < 60; m += 15) {
        // Proveri da li poslednji termin moze da stane pre 17:00
        const ukupnoMin = h * 60 + m + trajanjeMin
        if (ukupnoMin <= 17 * 60) {
          satnice.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
        }
      }
    }
    return satnice
  }

  function vremeUMinute(vreme: string) {
    const [h, m] = vreme.split(':').map(Number)
    return h * 60 + m
  }

  function jeLiZauzeto(vreme: string) {
  const noviPocetak = vremeUMinute(vreme)
  const noviKraj = noviPocetak + trajanjeMin

  return zauzetiTermini.some((t) => {
    const postojeciPocetak = vremeUMinute(
      new Date(t.datum_vreme).toTimeString().slice(0, 5)
    )
    const postojeciKraj = vremeUMinute(
      new Date(t.kraj_vreme).toTimeString().slice(0, 5)
    )
    console.log(`Proveravam ${vreme}: novi(${noviPocetak}-${noviKraj}) vs postojeci(${postojeciPocetak}-${postojeciKraj})`)
    return noviPocetak < postojeciKraj && noviKraj > postojeciPocetak
  })
}

  useEffect(() => {
    async function fetchFrizeri() {
      const { data, error } = await supabase.from('frizeri').select('*')
      if (!error) setFrizeri(data)
    }
    fetchFrizeri()
  }, [])

  useEffect(() => {
    if (selectedFrizer && selectedDatum) {
      fetchZauzetiTermini()
      setSelectedVreme(null)
    }
  }, [selectedFrizer, selectedDatum])

  async function fetchZauzetiTermini() {
  const { data, error } = await supabase
    .from('termini')
    .select('datum_vreme, kraj_vreme')
    .eq('frizer_id', selectedFrizer)
    .eq('status', 'aktivan')
    .gte('kraj_vreme', `${selectedDatum}T00:00:00+00`)
    .lte('datum_vreme', `${selectedDatum}T23:59:59+00`)

  if (!error && data) setZauzetiTermini(data)
}

async function proveraPostojecegTermina() {
  const pocetakISO = `${selectedDatum}T${selectedVreme}:00+00`
  const krajDate = new Date(`${selectedDatum}T${selectedVreme}:00Z`)
  krajDate.setMinutes(krajDate.getMinutes() + trajanjeMin)
  const krajISO = krajDate.toISOString()

  const { data, error } = await supabase
    .from('termini')
    .select('id')
    .eq('frizer_id', selectedFrizer)
    .eq('status', 'aktivan')
    .lt('datum_vreme', krajISO)
    .gt('kraj_vreme', pocetakISO)

  console.log('Provera preklapanja:', data, error)
  return data && data.length > 0
}

  async function handleBooking() {
  if (!selectedFrizer || !selectedDatum || !selectedVreme) {
    Alert.alert('Greška', 'Molimo odaberite frizera, datum i vreme')
    return
  }

  const postoji = await proveraPostojecegTermina()
  if (postoji) {
    Alert.alert('Greška', 'Ovaj termin je već zauzet, molimo odaberite drugo vreme')
    await fetchZauzetiTermini() // osvezi satnice
    setSelectedVreme(null)
    return
  }

  const { data: { user } } = await supabase.auth.getUser()

  const pocetakISO = `${selectedDatum}T${selectedVreme}:00Z`
const krajDate = new Date(pocetakISO)
krajDate.setMinutes(krajDate.getMinutes() + trajanjeMin)
const krajISO = krajDate.toISOString()

  const { error } = await supabase.from('termini').insert({
    korisnik_id: user?.id,
    frizer_id: selectedFrizer,
    usluga_id: uslugaId,
    datum_vreme: pocetakISO,
    kraj_vreme: krajISO,
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

  const satnice = generisiSatnice()

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Zakaži: {naziv}</Text>
      <Text style={styles.subtitle}>Trajanje: {trajanjeMin} min</Text>

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

      {/* Satnice */}
      {selectedFrizer && selectedDatum && (
        <>
          <Text style={styles.sectionTitle}>Odaberi vreme</Text>
          <View style={styles.row}>
            {satnice.map((v) => {
              const zauzeto = jeLiZauzeto(v)
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
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 5, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 15 },
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