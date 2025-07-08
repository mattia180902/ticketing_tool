package com.sincon.ticketing_app.supportservice;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SupportServiceRepository extends JpaRepository<SupportService, Long> {

    @Query("SELECT s FROM SupportService s WHERE s.category.id = :categoryId")
    List<SupportService> findAllByCategoryId(@Param("categoryId") Long categoryId);
}
