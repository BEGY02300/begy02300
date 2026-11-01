window.PORTFOLIO_CONFIG = {
  githubUsername: "BEGY02300",
  displayName: "Auguste",
  bio: "Je crée, je teste, je recommence.",
  location: "France",

  // Mets ici jusqu'à trois noms exacts de dépôts à afficher en premier.
  featuredRepositories: [],

  // Les comptes s'affichent dans le carrousel. Les détails restent modifiables ici.
  gamingPlatforms: [
    {
      id: "steam",
      name: "Steam",
      accountName: "BEGY02300",
      accountId: "76561198612871711",
      url: "https://steamcommunity.com/profiles/76561198612871711/",
      provider: "steam",
      gamesFile: "./games/steam/games.json",
      games: []
    },
    {
      id: "playstation",
      name: "PlayStation",
      accountName: "BEGY02300",
      url: "https://www.playstation.com/en-us/profile/BEGY02300/",
      provider: "playstation",
      games: []
    },
    {
      id: "xbox",
      name: "Xbox",
      accountName: "",
      provider: "manual",
      // API non disponible pour un compte personnel ; conserve les données manuelles.
      notice: "Ajoute ton gamertag Xbox pour configurer cette plateforme.",
      games: []
    },
    {
      id: "epic",
      name: "Epic Games",
      accountName: "Begy02300",
      url: "https://www.epicgames.com/id/",
      provider: "manual",
      gamesFile: "./games/epic/games.json",
      // Endpoint non officiel à authentification fragile : bibliothèque conservée en manuel.
      notice: "Ajoute tes jeux dans games/epic/games.json pour afficher ta bibliothèque.",
      games: []
    },
    {
      id: "ubisoft",
      name: "Ubisoft Connect",
      accountName: "BEGY02300",
      url: "https://www.ubisoft.com/en-us/profile/BEGY02300",
      provider: "manual",
      // API non disponible pour une bibliothèque personnelle.
      notice: "Ubisoft ne propose pas d’API publique pour afficher ta bibliothèque personnelle.",
      games: []
    },
    {
      id: "ea",
      name: "EA",
      accountName: "BEGY02300",
      url: "https://profile.ea.com/BEGY02300",
      provider: "manual",
      // API non disponible en libre-service pour les profils personnels.
      notice: "EA ne propose pas d’API publique pour afficher ta bibliothèque personnelle.",
      games: []
    }
  ],

  socials: [
    {
      name: "Discord",
      username: "begy02300",
      url: "https://discord.com/users/1125783712316002424",
      description: "Me retrouver et discuter.",
      details: [
        { label: "Identifiant", value: "begy02300" },
        { label: "ID du compte", value: "1125783712316002424" }
      ]
    },
    {
      name: "Roblox",
      username: "BEGY504",
      url: "https://www.roblox.com/fr/users/6136427497/profile",
      description: "Mon profil Roblox.",
      details: [
        { label: "Identifiant", value: "BEGY504" },
        { label: "ID du compte", value: "6136427497" }
      ]
    },
    {
      name: "PlayStation",
      username: "BEGY02300",
      url: "https://www.playstation.com/en-us/profile/BEGY02300/",
      description: "Mon compte PlayStation.",
      details: [{ label: "ID en ligne", value: "BEGY02300" }]
    },
    {
      name: "Steam",
      username: "BEGY02300",
      url: "https://steamcommunity.com/profiles/76561198612871711/",
      description: "Mon profil Steam.",
      details: [
        { label: "Identifiant", value: "BEGY02300" },
        { label: "ID du compte", value: "76561198612871711" }
      ]
    },
    {
      name: "Instagram",
      username: "BEGY02300",
      url: "https://www.instagram.com/auguste_begy02300/",
      // API non disponible pour un compte personnel public.
      description: "Mon compte Instagram.",
      details: [{ label: "Identifiant", value: "BEGY02300" }]
    },
    {
      name: "Rockstar",
      username: "BEGY_v",
      url: "https://socialclub.rockstargames.com/member/Begy_v/games",
      // Endpoint non documenté et session privée : laisse le profil manuel.
      description: "Mon compte Rockstar.",
      details: [{ label: "Identifiant", value: "BEGY_v" }]
    },
    {
      name: "Ubisoft",
      username: "BEGY02300",
      url: "https://www.ubisoft.com/en-us/profile/BEGY02300",
      // API non disponible pour une bibliothèque personnelle.
      description: "Mon compte Ubisoft.",
      details: [
        { label: "Identifiant", value: "BEGY02300" }
      ]
    },
    {
      name: "Electronic Arts",
      username: "BEGY02300",
      url: "https://profile.ea.com/BEGY02300",
      // API non disponible en libre-service pour les profils personnels.
      description: "Mon compte Electronic Arts.",
      details: [{ label: "Identifiant", value: "BEGY02300" }]
    },
    {
      name: "Patreon",
      username: "Begy02300",
      url: "https://www.patreon.com/c/Begy02300",
      description: "Mon compte Patreon.",
      details: [
        { label: "Identifiant", value: "Begy02300" }
      ]
    },
    {
      name: "Replit",
      username: "BEGY02",
      url: "https://replit.com/@BEGY02",
      // Aucune API officielle de profil public n’est documentée.
      description: "Mon compte Replit.",
      details: [
        { label: "Identifiant", value: "BEGY02" }
      ]
    },
    {
      name: "GitLab",
      username: "BEGY02",
      url: "https://gitlab.com/begy02",
      description: "Mon compte GitLab.",
      details: [{ label: "Identifiant", value: "BEGY02" }]
    },
    {
      name: "BF6 Tracker",
      username: "BEGY02300",
      url: "https://tracker.gg/bf6/profile/1014659847596/overview",
      description: "Mon compte BF6 Tracker.",
      details: [
        { label: "Identifiant", value: "BEGY02300" },
        { label: "ID du compte", value: "1014659847596" }
      ]
    },
    {
      name: "Fortnite Tracker",
      username: "Begy02300",
      url: "https://fortnitetracker.com/fortnite/profile/epic/Begy02300/matchmaking/overview",
      description: "Mon compte Fortnite Tracker.",
      details: [{ label: "Identifiant", value: "Begy02300" }]
    },
    {
      name: "R6 Mobile Tracker",
      username: "Begy02300",
      url: "https://tracker.gg/r6mobile/profile/ign/76fd10e3-bd00-464e-a5fd-05f07f16cbfa/overview",
      description: "Mon compte R6 Mobile Tracker.",
      details: [
        { label: "Identifiant", value: "Begy02300" },
        { label: "ID du compte", value: "76fd10e3-bd00-464e-a5fd-05f07f16cbfa" }
      ]
    }
  ]
};