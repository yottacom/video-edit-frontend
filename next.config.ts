// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'example.com',        // Replace with your actual image domain
      'another-domain.com',
      'via.placeholder.com', // For the placeholder images in the dummy data
      'www.w3schools.com',   // For the video poster images if they are on this domain
      // ... add any other domains where your images are hosted
    ],
  },
};

module.exports = nextConfig;