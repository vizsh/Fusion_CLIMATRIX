import Benefits from './components/Benefits'
import Footer from './components/Footer'
import Hero from './components/Hero'
import Impact from './components/Impact'
import Journey from './components/Journey'
import Navbar from './components/Navbar'
import Platform from './components/Platform'
import Problem from './components/Problem'
import Roadmap from './components/Roadmap'
import Solution from './components/Solution'
import { useReveal } from './useReveal'
import './landing.css'

export default function LandingPage() {
  useReveal()
  return (
    <div className="lp-root">
      <Navbar />
      <Hero />
      <Problem />
      <Solution />
      <Journey />
      <Platform />
      <Benefits />
      <Impact />
      <Roadmap />
      <Footer />
    </div>
  )
}
