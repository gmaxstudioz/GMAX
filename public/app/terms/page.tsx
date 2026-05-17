import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Terms of Service — GMAX Studioz",
    description: "Terms and conditions of using GMAX Studioz services.",
};

export default function TermsPage() {
    return (
        <main className="min-h-screen pt-32 pb-24 px-4 sm:px-6 md:px-20 max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-heading font-bold mb-8">Terms of Service</h1>
            <div className="prose prose-invert prose-lg text-gray-300">
                <p>Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
                
                <h2 className="text-2xl font-semibold text-white mt-8 mb-4">1. Acceptance of Terms</h2>
                <p>By accessing and using the services of GMAX Studioz, you accept and agree to be bound by the terms and provision of this agreement. In addition, when using these particular services, you shall be subject to any posted guidelines or rules applicable to such services.</p>
                
                <h2 className="text-2xl font-semibold text-white mt-8 mb-4">2. Services and Bookings</h2>
                <p>GMAX Studioz provides professional photography, videography, and digital products. All bookings are subject to availability and confirmation. A deposit may be required to secure your booking slot. Specific terms regarding rescheduling or cancellations will be provided during the booking process.</p>

                <h2 className="text-2xl font-semibold text-white mt-8 mb-4">3. Digital Products and Downloads</h2>
                <p>All digital products purchased through our shop are subject to our licensing terms. Upon purchase, you are granted a non-exclusive, non-transferable license to use the digital assets. Redistribution, reselling, or sharing of raw source files is strictly prohibited unless explicitly stated otherwise.</p>

                <h2 className="text-2xl font-semibold text-white mt-8 mb-4">4. Intellectual Property</h2>
                <p>The Site and its original content, features, and functionality are owned by GMAX Studioz and are protected by international copyright, trademark, patent, trade secret, and other intellectual property or proprietary rights laws. GMAX Studioz retains the copyright to all captured media unless a specific buyout agreement is signed.</p>

                <h2 className="text-2xl font-semibold text-white mt-8 mb-4">5. Limitation of Liability</h2>
                <p>In no event shall GMAX Studioz, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.</p>
            </div>
        </main>
    );
}
