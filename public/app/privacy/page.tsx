import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Privacy Policy — GMAX Studioz",
    description: "Privacy policy and data handling practices for GMAX Studioz.",
};

export default function PrivacyPage() {
    return (
        <main className="min-h-screen pt-32 pb-24 px-4 sm:px-6 md:px-20 max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-heading font-bold mb-8">Privacy Policy</h1>
            <div className="prose prose-invert prose-lg text-gray-300">
                <p>Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
                
                <h2 className="text-2xl font-semibold text-white mt-8 mb-4">1. Introduction</h2>
                <p>Welcome to GMAX Studioz. We respect your privacy and are committed to protecting your personal data. This privacy policy will inform you as to how we look after your personal data when you visit our website and tell you about your privacy rights and how the law protects you.</p>
                
                <h2 className="text-2xl font-semibold text-white mt-8 mb-4">2. Data We Collect</h2>
                <p>We may collect, use, store and transfer different kinds of personal data about you which we have grouped together as follows:</p>
                <ul className="list-disc pl-6 space-y-2 mt-4">
                    <li><strong>Identity Data</strong> includes first name, last name, username or similar identifier.</li>
                    <li><strong>Contact Data</strong> includes billing address, email address and telephone numbers.</li>
                    <li><strong>Transaction Data</strong> includes details about payments to and from you and other details of products and services you have purchased from us.</li>
                </ul>

                <h2 className="text-2xl font-semibold text-white mt-8 mb-4">3. How We Use Your Data</h2>
                <p>We will only use your personal data when the law allows us to. Most commonly, we will use your personal data in the following circumstances:</p>
                <ul className="list-disc pl-6 space-y-2 mt-4">
                    <li>Where we need to perform the contract we are about to enter into or have entered into with you (e.g., booking a session or purchasing a digital product).</li>
                    <li>Where it is necessary for our legitimate interests and your interests and fundamental rights do not override those interests.</li>
                    <li>Where we need to comply with a legal obligation.</li>
                </ul>

                <h2 className="text-2xl font-semibold text-white mt-8 mb-4">4. Payment Processing</h2>
                <p>We use third-party services for payment processing (e.g., Paystack). We will not store or collect your payment card details. That information is provided directly to our third-party payment processors whose use of your personal information is governed by their Privacy Policy.</p>

                <h2 className="text-2xl font-semibold text-white mt-8 mb-4">5. Contact Us</h2>
                <p>If you have any questions about this privacy policy or our privacy practices, please contact us at our provided support channels.</p>
            </div>
        </main>
    );
}
