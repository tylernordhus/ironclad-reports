import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

const WMO = {
  0: 'Clear', 1: 'Mainly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Icy Fog',
  51: 'Light Drizzle', 53: 'Drizzle', 55: 'Heavy Drizzle',
  61: 'Light Rain', 63: 'Rain', 65: 'Heavy Rain',
  71: 'Light Snow', 73: 'Snow', 75: 'Heavy Snow', 77: 'Snow Grains',
  80: 'Showers', 81: 'Showers', 82: 'Heavy Showers',
  85: 'Snow Showers', 86: 'Heavy Snow Showers',
  95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm',
}

export async function GET(request, { params }) {
  try {
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')

    const { data: project } = await supabase
      .from('projects')
      .select('location')
      .eq('id', params.projectId)
      .single()

    if (!project?.location) return Response.json({ weather: null })

    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(project.location)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'IroncladReports/1.0 (construction field reporting app)' } }
    )
    const geoData = await geoRes.json()
    if (!geoData?.[0]) return Response.json({ weather: null })

    const { lat, lon } = geoData[0]
    const today = new Date().toISOString().split('T')[0]
    const isPast = dateParam && dateParam < today

    let temp, desc

    if (isPast) {
      const wxRes = await fetch(
        `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${dateParam}&end_date=${dateParam}&daily=weather_code,temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit`
      )
      const wxData = await wxRes.json()
      const maxT = wxData.daily?.temperature_2m_max?.[0]
      const minT = wxData.daily?.temperature_2m_min?.[0]
      if (maxT == null || minT == null) return Response.json({ weather: null })
      temp = Math.round((maxT + minT) / 2)
      const code = wxData.daily?.weather_code?.[0]
      desc = WMO[code] ?? 'Unknown'
    } else {
      const wxRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph`
      )
      const wxData = await wxRes.json()
      temp = Math.round(wxData.current?.temperature_2m)
      const code = wxData.current?.weather_code
      desc = WMO[code] ?? 'Unknown'
    }

    return Response.json({ weather: `${temp}°F, ${desc}` })
  } catch {
    return Response.json({ weather: null })
  }
}
