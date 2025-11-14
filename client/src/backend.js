const apiUrl = "http://172.20.10.5:8080";

const BackendService = {
  createOrUpdateService: async ({
    serviceId,
    userId,
    referralPerc,
    name,
    description,
    area,
  }) => {
    return await fetch(`${apiUrl}/service`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        service_id: serviceId,
        user_id: userId,
        referral_perc: referralPerc,
        name,
        description,
        serviceable_area: area,
      }),
    })
      .then((res) => {
        if (res.status > 201) throw new Error("Failed to create service");
        return res.json();
      })
      .then((data) => {
        console.log(data);
      })
      .catch((error) => {
        console.error(">> ", error);
      });
  },

  searchService: async ({ category, lng, lat }) => {
    return await fetch(
      `${apiUrl}/search/service?cat=${category}&loc=${lng},${lat}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
    )
      .then((res) => {
        if (res.status > 201) throw new Error("Failed to search service");
        return res.json();
      })
      .then((data) => {
        console.log(data);
        return data;
      })
      .catch((error) => {
        console.error(">> ", error);
      });
  },
};

export { BackendService };
